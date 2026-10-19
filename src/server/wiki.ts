import { normalize } from "../lib/search";
import type { CategoryId, PlaceDetails } from "../lib/types";
import { USER_AGENT } from "./overpass";

export interface DetailsInput {
  id: string;
  name: string;
  cat: CategoryId;
  lat: number;
  lon: number;
  wikidata?: string;
  wikipedia?: string;
}

const HEADERS = { "User-Agent": USER_AGENT, Accept: "application/json" };
const GENERIC = new Set(["spielplatz", "park", "berlin", "museum", "stadtbad", "garten", "der", "die", "das", "und", "am", "im", "an", "fuer", "the", "of", "platz"]);

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const tokens = (s: string) => normalize(s).split(" ").filter((t) => t.length > 2 && !GENERIC.has(t));

/** True when the two names share a meaningful word. */
export function namesMatch(a: string, b: string): boolean {
  const ta = new Set(tokens(a));
  return tokens(b).some((t) => ta.has(t));
}

const stripHtml = (s?: string) => s?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || undefined;

interface WikiRef {
  lang: string;
  title: string;
}

async function fromWikidata(qid: string): Promise<{ wiki?: WikiRef; image?: string }> {
  const data = await getJson<any>(`https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(qid)}.json`);
  const ent = data?.entities?.[qid] ?? (data?.entities ? Object.values(data.entities)[0] : null);
  if (!ent) return {};
  const links = ent.sitelinks ?? {};
  const wiki = links.dewiki
    ? { lang: "de", title: links.dewiki.title }
    : links.enwiki
      ? { lang: "en", title: links.enwiki.title }
      : undefined;
  const image = ent.claims?.P18?.[0]?.mainsnak?.datavalue?.value as string | undefined;
  return { wiki, image };
}

async function geosearchWiki(input: DetailsInput): Promise<WikiRef | undefined> {
  for (const lang of ["de", "en"]) {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${input.lat}%7C${input.lon}&gsradius=400&gslimit=15&format=json`;
    const data = await getJson<any>(url);
    const hit = (data?.query?.geosearch ?? []).find((g: any) => namesMatch(input.name, g.title));
    if (hit) return { lang, title: hit.title };
  }
  return undefined;
}

async function wikiPage(ref: WikiRef) {
  const url =
    `https://${ref.lang}.wikipedia.org/w/api.php?action=query&format=json&redirects=1` +
    `&prop=extracts%7Cpageimages%7Cinfo&exintro=1&explaintext=1&exsentences=4&piprop=name&inprop=url` +
    `&titles=${encodeURIComponent(ref.title)}`;
  const data = await getJson<any>(url);
  const page = data?.query?.pages ? (Object.values(data.query.pages)[0] as any) : null;
  if (!page || page.missing !== undefined) return null;
  return {
    summary: (page.extract as string | undefined)?.trim() || undefined,
    url: page.fullurl as string,
    title: page.title as string,
    image: page.pageimage as string | undefined,
  };
}

async function commonsFile(file: string): Promise<PlaceDetails["photo"]> {
  const title = file.startsWith("File:") ? file : `File:${file}`;
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo` +
    `&iiprop=url%7Cextmetadata&iiurlwidth=800&titles=${encodeURIComponent(title)}`;
  const data = await getJson<any>(url);
  const page = data?.query?.pages ? (Object.values(data.query.pages)[0] as any) : null;
  return toPhoto(page);
}

function toPhoto(page: any): PlaceDetails["photo"] {
  const info = page?.imageinfo?.[0];
  if (!info) return undefined;
  if (!/\.(jpe?g|png|webp)$/i.test(page.title ?? "")) return undefined;
  const meta = info.extmetadata ?? {};
  return {
    url: info.thumburl ?? info.url,
    pageUrl: info.descriptionurl,
    artist: stripHtml(meta.Artist?.value),
    license: stripHtml(meta.LicenseShortName?.value),
  };
}

async function commonsNearby(input: DetailsInput): Promise<PlaceDetails["photo"]> {
  const radius = input.cat === "park" || input.cat === "animals" ? 150 : 80;
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=geosearch` +
    `&ggscoord=${input.lat}%7C${input.lon}&ggsradius=${radius}&ggsnamespace=6&ggslimit=15` +
    `&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=800`;
  const data = await getJson<any>(url);
  const pages = data?.query?.pages ? (Object.values(data.query.pages) as any[]) : [];
  // Prefer a photo whose file name mentions the place; for big places (parks, zoos) any nearby photo is fine.
  const named = pages.find((p) => namesMatch(input.name, p.title));
  const pick = named ?? (input.cat === "park" || input.cat === "animals" ? pages[0] : undefined);
  return toPhoto(pick);
}

async function googleRating(input: DetailsInput): Promise<PlaceDetails["google"]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return undefined;
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.rating,places.userRatingCount,places.googleMapsUri",
      },
      body: JSON.stringify({
        textQuery: input.name,
        locationBias: { circle: { center: { latitude: input.lat, longitude: input.lon }, radius: 300 } },
        maxResultCount: 1,
      }),
      signal: AbortSignal.timeout(6000),
    });
    const data = (await res.json()) as any;
    const p = data?.places?.[0];
    return p?.rating ? { rating: p.rating, count: p.userRatingCount ?? 0, url: p.googleMapsUri } : undefined;
  } catch {
    return undefined;
  }
}

const detailCache = new Map<string, { at: number; value: PlaceDetails }>();

export async function loadPlaceDetails(input: DetailsInput): Promise<PlaceDetails> {
  const hit = detailCache.get(input.id);
  if (hit && Date.now() - hit.at < 6 * 60 * 60 * 1000) return hit.value;

  let wiki: WikiRef | undefined;
  let image: string | undefined;

  if (input.wikipedia && input.wikipedia.includes(":")) {
    const [lang, ...rest] = input.wikipedia.split(":");
    if (/^[a-z]{2,3}$/.test(lang)) wiki = { lang, title: rest.join(":") };
  }
  if (input.wikidata && /^Q\d+$/.test(input.wikidata)) {
    const wd = await fromWikidata(input.wikidata);
    wiki ??= wd.wiki;
    image = wd.image;
  }
  if (!wiki) wiki = await geosearchWiki(input);

  const [page, google] = await Promise.all([wiki ? wikiPage(wiki) : null, googleRating(input)]);
  image ??= page?.image;

  const photo = (image ? await commonsFile(image) : undefined) ?? (await commonsNearby(input));

  const value: PlaceDetails = {
    summary: page?.summary,
    wikiUrl: page?.url,
    wikiTitle: page?.title,
    photo,
    google,
  };
  detailCache.set(input.id, { at: Date.now(), value });
  if (detailCache.size > 2000) detailCache.delete(detailCache.keys().next().value!);
  return value;
}

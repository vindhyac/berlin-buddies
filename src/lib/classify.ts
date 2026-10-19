import type { CategoryId, Place } from "./types";

export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const GONE_PREFIX = /^(disused|abandoned|demolished|removed|razed|was):/;

/** Quality filters from spec §3.2. Returns a reason when the place should be hidden. */
export function rejectReason(tags: Record<string, string>, today = new Date()): string | null {
  if (!tags.name?.trim()) return "no-name";
  if (tags.access === "private" || tags.access === "no") return "private";
  if (/^(closed|abandoned|disused)$/.test(tags.operational_status ?? "")) return "closed";
  if (/^(closed|off)$/i.test((tags.opening_hours ?? "").trim())) return "closed";
  if (tags.end_date) {
    const end = parseOsmDate(tags.end_date);
    if (end && end < today) return "ended";
  }
  for (const key of Object.keys(tags)) if (GONE_PREFIX.test(key)) return "gone";
  return null;
}

function parseOsmDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!m) return null;
  // Treat "2019" as the end of 2019, "2019-05" as the end of May 2019.
  const y = +m[1];
  const mo = m[2] ? +m[2] : 12;
  const d = m[3] ? +m[3] : new Date(y, mo, 0).getDate();
  return new Date(y, mo - 1, d, 23, 59, 59);
}

const SCIENCE_MUSEUM = /^(science|technology|children|natural_history|nature|planetarium|astronomy)$/;
const FARM_NAME = /kinderbauernhof|jugendfarm|kinder- ?und jugendfarm|streichelzoo|tiergehege|wildgehege/i;

/** Map OSM tags to one of the six categories, plus a short "kind" label. */
export function classify(tags: Record<string, string>): { cat: CategoryId; kind: string } | null {
  const { leisure, tourism, amenity, sport } = tags;
  const museumType = tags.museum ?? "";

  if (amenity === "planetarium") return { cat: "science", kind: "Planetarium" };
  if (tourism === "museum" && SCIENCE_MUSEUM.test(museumType)) {
    const kinds: Record<string, string> = {
      children: "Children's museum",
      natural_history: "Natural history museum",
      nature: "Nature museum",
      technology: "Technology museum",
    };
    return { cat: "science", kind: kinds[museumType] ?? "Science museum" };
  }
  if (tourism === "zoo") {
    const z = tags.zoo;
    const kind = z === "petting_zoo" ? "Petting zoo" : z === "enclosure" ? "Animal enclosure" : z === "wildlife_park" ? "Wildlife park" : z === "aviary" ? "Aviary" : "Zoo";
    return { cat: "animals", kind };
  }
  if (FARM_NAME.test(tags.name ?? "") || tags.animal === "yes" || tags.farm === "petting") {
    return { cat: "animals", kind: "City farm" };
  }
  if (leisure === "water_park") return { cat: "water", kind: "Water park" };
  if (leisure === "splash_pad" || tags.playground === "splash_pad") return { cat: "water", kind: "Splash pad" };
  if (amenity === "public_bath") return { cat: "water", kind: tags.indoor === "yes" ? "Indoor pool" : "Pool" };
  if (leisure === "sports_centre" && /swimming/.test(sport ?? "")) {
    const outdoor = /sommerbad|freibad|strandbad/i.test(tags.name ?? "") || tags.indoor === "no";
    return { cat: "water", kind: outdoor ? "Outdoor pool" : "Indoor pool" };
  }
  if (leisure === "playground") return { cat: "play", kind: tags.indoor === "yes" ? "Indoor playground" : "Playground" };
  if (leisure === "indoor_play") return { cat: "play", kind: "Indoor play" };
  if (leisure === "miniature_golf") return { cat: "play", kind: "Mini golf" };
  if (tourism === "theme_park") return { cat: "play", kind: "Theme park" };
  if (leisure === "park") return { cat: "park", kind: "Park" };
  if (tourism === "museum") return { cat: "museum", kind: "Museum" };
  return null;
}

export function formatAddress(tags: Record<string, string>): string | undefined {
  const street = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ");
  const city = [tags["addr:postcode"], tags["addr:suburb"] ?? tags["addr:city"]].filter(Boolean).join(" ");
  const out = [street, city].filter(Boolean).join(", ");
  return out || undefined;
}

function age(v?: string): number | undefined {
  if (!v) return undefined;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 && n < 99 ? n : undefined;
}

function website(tags: Record<string, string>): string | undefined {
  const w = tags.website ?? tags["contact:website"] ?? tags.url;
  if (!w) return undefined;
  const first = w.split(";")[0].trim();
  return /^https?:\/\//i.test(first) ? first : `https://${first}`;
}

/** Turn one Overpass element into a Place, or null if it fails the filters. */
export function toPlace(el: OsmElement, today = new Date()): Place | null {
  const tags = el.tags ?? {};
  if (rejectReason(tags, today)) return null;
  const c = classify(tags);
  if (!c) return null;
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat == null || lon == null) return null;

  const fee = tags.fee === "no" ? "no" : tags.fee && tags.fee !== "no" ? "yes" : undefined;
  const wc = tags.wheelchair;
  return {
    id: `${el.type}/${el.id}`,
    name: tags.name.trim(),
    cat: c.cat,
    kind: c.kind,
    lat: +lat.toFixed(6),
    lon: +lon.toFixed(6),
    address: formatAddress(tags),
    website: website(tags),
    wikidata: tags.wikidata,
    wikipedia: tags.wikipedia,
    hasPhotoTag: Boolean(tags.image || tags.wikimedia_commons) || undefined,
    fee,
    wheelchair: wc === "yes" || wc === "limited" || wc === "no" ? wc : undefined,
    minAge: age(tags.min_age),
    maxAge: age(tags.max_age),
    hours: tags.opening_hours,
    indoor: tags.indoor === "yes" || tags.building === "yes" || c.kind === "Indoor pool" || c.cat === "museum" || c.cat === "science" || undefined,
  };
}

/** Same place can be tagged twice (node + way). Keep the richer one per name+~100 m. */
export function dedupe(places: Place[]): Place[] {
  const seen = new Map<string, Place>();
  const richness = (p: Place) =>
    (p.wikidata ? 4 : 0) + (p.website ? 1 : 0) + (p.address ? 1 : 0) + (p.hours ? 1 : 0) + (p.id.startsWith("node") ? 0 : 1);
  for (const p of places) {
    const key = `${p.cat}|${p.name.toLowerCase()}|${p.lat.toFixed(3)}|${p.lon.toFixed(3)}`;
    const prev = seen.get(key);
    if (!prev || richness(p) > richness(prev)) seen.set(key, p);
  }
  return [...seen.values()];
}

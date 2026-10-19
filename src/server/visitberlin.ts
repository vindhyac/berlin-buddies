import { WINDOW_DAYS, addDays, berlinToday, inWindow } from "../lib/events";
import type { EventsResponse, KidEvent } from "../lib/types";

/**
 * Family events from visitBerlin's children's calendar.
 *
 * There is no public API, but every page carries schema.org JSON-LD: the listing has an ItemList
 * of event URLs and each event page has an Event with dates, venue, address and coordinates.
 * We read only that, never the page layout. The listing puts permanent exhibitions first and then
 * dated events in date order, so we walk pages until events start after our window.
 */

const BASE = "https://www.visitberlin.de";
const LISTING = `${BASE}/en/events-children-Berlin`;
const UA = "BerlinBuddies/1.0 (family map; links every event back to visitberlin.de)";
const MAX_PAGES = 14;
const CONCURRENCY = 6;
const CACHE_MS = 6 * 60 * 60 * 1000;
/** Longer than this and an event is listed under "Ongoing" instead of by date. */
const ONGOING_DAYS = 21;
const EXCERPT_CHARS = 240;

// ---------- parsing (pure, tested) ----------

function jsonLd(html: string): any[] {
  const out: any[] = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const j = JSON.parse(m[1]);
      out.push(...(Array.isArray(j["@graph"]) ? j["@graph"] : [j]));
    } catch {
      // a broken block shouldn't hide the others
    }
  }
  return out;
}

const types = (x: any): string[] => (Array.isArray(x?.["@type"]) ? x["@type"] : [x?.["@type"]]).filter(Boolean);

/** Event page URLs, in listing order. */
export function parseListing(html: string): string[] {
  const list = jsonLd(html).find((x) => types(x).includes("ItemList"));
  const urls: string[] = (list?.itemListElement ?? []).map((i: any) => i?.url).filter((u: unknown) => typeof u === "string");
  return urls.filter((u) => u.startsWith(`${BASE}/en/event/`));
}

const KIND: Record<string, string> = {
  TheaterEvent: "Theatre",
  MusicEvent: "Music",
  ScreeningEvent: "Film",
  VisualArtsEvent: "Art",
  ExhibitionEvent: "Exhibition",
  ChildrensEvent: "Kids' event",
  EducationEvent: "Workshop",
  DanceEvent: "Dance",
  ComedyEvent: "Comedy",
  Festival: "Festival",
  SportsEvent: "Sport",
  LiteraryEvent: "Reading",
  FoodEvent: "Food",
  SocialEvent: "Meet-up",
};

function decode(s: string): string {
  return s
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** First sentences up to the limit, never a hard mid-word cut. */
export function excerpt(text: string, max = EXCERPT_CHARS): string {
  const t = decode(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return stop > max * 0.5 ? cut.slice(0, stop + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

const localIso = (s: unknown): string | undefined => (typeof s === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(s) ? s.slice(0, 16) : undefined);
const days = (a: string, b: string) => (Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 86_400_000;

export function parseEvent(html: string, url: string): KidEvent | null {
  const ev = jsonLd(html).find((x) => types(x).some((t) => t === "Event" || t.endsWith("Event") || t === "Festival"));
  if (!ev) return null;
  const start = localIso(ev.startDate);
  const loc = ev.location ?? {};
  const lat = Number(loc.geo?.latitude);
  const lon = Number(loc.geo?.longitude);
  if (!ev.name || !start || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const end = localIso(ev.endDate);
  const a = loc.address ?? {};
  const address = [a.streetAddress, [a.postalCode, a.addressLocality].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const kind = types(ev).map((t) => KIND[t]).find(Boolean) ?? "Family event";
  const slug = url.split("/en/event/")[1]?.replace(/[?#].*$/, "") ?? url;
  return {
    id: `vb:${slug}`,
    name: decode(String(ev.name)),
    url,
    kind,
    start,
    end,
    hasTime: !start.endsWith("T00:00"),
    ongoing: end != null && days(start, end) > ONGOING_DAYS,
    venue: decode(String(loc.name ?? "Venue")),
    address: address ? decode(address) : undefined,
    lat,
    lon,
    image: typeof ev.image?.url === "string" ? ev.image.url : undefined,
    excerpt: typeof ev.description === "string" ? excerpt(ev.description) : undefined,
    ticketUrl: typeof ev.offers?.url === "string" ? ev.offers.url : undefined,
  };
}

// ---------- fetching ----------

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.text();
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

/** Event pages rarely change, so keep parsed events across refreshes of the listing. */
const eventCache = new Map<string, KidEvent | null>();

async function crawl(): Promise<KidEvent[]> {
  const today = berlinToday();
  const horizon = addDays(today, WINDOW_DAYS);
  const seen = new Set<string>();
  const events: KidEvent[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const urls = parseListing(await get(`${LISTING}?page=${page}`)).filter((u) => !seen.has(u));
    if (!urls.length) break;
    urls.forEach((u) => seen.add(u));
    const parsed = await mapLimit(urls, CONCURRENCY, async (u) => {
      if (eventCache.has(u)) return eventCache.get(u)!;
      const e = await get(u).then((h) => parseEvent(h, u)).catch(() => null);
      eventCache.set(u, e);
      return e;
    });
    const ok = parsed.filter((e): e is KidEvent => e != null);
    events.push(...ok.filter((e) => inWindow(e, today)));
    // Past the permanent block, the listing is in date order: stop once a whole page starts after the window.
    if (ok.length && ok.every((e) => !e.ongoing && e.start.slice(0, 10) >= horizon)) break;
  }
  const byId = new Map(events.map((e) => [e.id, e]));
  return [...byId.values()].sort((a, b) => a.start.localeCompare(b.start));
}

let cache: { at: number; value: EventsResponse } | null = null;
let inflight: Promise<EventsResponse> | null = null;

export async function loadKidEvents(): Promise<EventsResponse> {
  if (cache && Date.now() - cache.at < CACHE_MS) return { ...cache.value, source: "cache" };
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const value: EventsResponse = { events: await crawl(), source: "live", fetchedAt: new Date().toISOString() };
      cache = { at: Date.now(), value };
      return value;
    } catch (err) {
      console.warn("[berlin-buddies] visitBerlin events failed", err);
      // Better a few hours stale than nothing.
      if (cache) return { ...cache.value, source: "cache" };
      return { events: [], source: "unavailable", fetchedAt: new Date().toISOString() } satisfies EventsResponse;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

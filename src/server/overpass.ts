import { BERLIN_BBOX } from "../lib/area";
import { dedupe, toPlace, type OsmElement } from "../lib/classify";
import type { Place, PlacesResponse } from "../lib/types";
import { FALLBACK_PLACES } from "./fallback";

export const USER_AGENT = "BerlinBuddies/0.1 (free family map of Berlin; https://www.openstreetmap.org/copyright)";

/**
 * Mirrors, raced in parallel; first complete answer wins (spec §3.1).
 * More reliable ones first only matters for logs, they all start at once.
 */
export const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

const TIMEOUT_MS = 58_000;
const CACHE_MS = 60 * 60 * 1000;

/**
 * Bounding box instead of the admin-area lookup (the fix proposed in §3.3):
 * the area lookup is the slow part on busy mirrors. No `out` limit, so results are never cut short.
 */
export function buildQuery(): string {
  const { south, west, north, east } = BERLIN_BBOX;
  return `[out:json][timeout:55][bbox:${south},${west},${north},${east}];
(
  nwr["leisure"~"^(playground|park|water_park|indoor_play|miniature_golf|splash_pad)$"]["name"];
  nwr["tourism"~"^(zoo|museum|theme_park)$"]["name"];
  nwr["amenity"~"^(public_bath|planetarium)$"]["name"];
  nwr["leisure"="sports_centre"]["sport"~"swimming"]["name"];
);
out tags center qt;`;
}

interface OverpassJson {
  elements?: OsmElement[];
  remark?: string;
}

async function fetchMirror(url: string, query: string, signal: AbortSignal): Promise<{ url: string; data: OverpassJson }> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Accept: "application/json",
    },
    body: `data=${encodeURIComponent(query)}`,
    signal,
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const data = (await res.json()) as OverpassJson;
  // A "remark" with an error means the server gave up part-way: treat as failed so we never show cut-short results.
  if (data.remark && /error|timed out|out of memory/i.test(data.remark)) throw new Error(`${url} → ${data.remark}`);
  if (!Array.isArray(data.elements) || data.elements.length < 500) throw new Error(`${url} → too few elements`);
  return { url, data };
}

/** Race all mirrors; abort the losers once one wins. */
export async function raceMirrors(query: string, mirrors = OVERPASS_MIRRORS) {
  const winner = new AbortController();
  const signal = AbortSignal.any([winner.signal, AbortSignal.timeout(TIMEOUT_MS)]);
  try {
    return await Promise.any(mirrors.map((m) => fetchMirror(m, query, signal)));
  } finally {
    winner.abort();
  }
}

export function cleanElements(elements: OsmElement[], today = new Date()): Place[] {
  const places: Place[] = [];
  for (const el of elements) {
    const p = toPlace(el, today);
    if (p) places.push(p);
  }
  return dedupe(places);
}

let cache: { at: number; value: PlacesResponse } | null = null;
let inflight: Promise<PlacesResponse> | null = null;

export async function loadBerlinFamilyPlaces(): Promise<PlacesResponse> {
  if (cache && Date.now() - cache.at < CACHE_MS) return { ...cache.value, source: "cache" };
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const { url, data } = await raceMirrors(buildQuery());
      const places = cleanElements(data.elements!);
      const value: PlacesResponse = {
        places,
        source: "live",
        mirror: new URL(url).host,
        fetchedAt: new Date().toISOString(),
        rawCount: data.elements!.length,
      };
      cache = { at: Date.now(), value };
      return value;
    } catch (err) {
      console.warn("[berlin-buddies] all Overpass mirrors failed, using fallback", err);
      // Don't cache the fallback, so the next visit tries the live data again.
      return { places: FALLBACK_PLACES, source: "fallback", fetchedAt: new Date().toISOString() } satisfies PlacesResponse;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

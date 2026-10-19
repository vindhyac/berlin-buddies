import type { Place } from "./types";

/** Top family picks scoring from spec §5. */
export function familyScore(p: Place): number {
  let s = 0;
  if (p.wikidata || p.wikipedia) s += 4;
  if (p.cat === "science" || p.cat === "animals") s += 3;
  else if (p.cat === "museum" || p.cat === "water") s += 2;
  if (p.website) s += 1;
  if (p.hasPhotoTag) s += 1;
  return s;
}

export function topPicks<T extends Place>(places: T[], limit = 60): T[] {
  return places
    .map((p) => ({ p, s: familyScore(p) }))
    .filter((x) => x.s >= 3)
    .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name, "de"))
    .slice(0, limit)
    .map((x) => x.p);
}

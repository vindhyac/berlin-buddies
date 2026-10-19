import { CATEGORY_BY_ID } from "./categories";
import type { Place } from "./types";

/** Lower-case, fold German letters (ä→ae, ß→ss) and strip other accents. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Both spellings ("strasse"/"str") and both umlaut forms ("muller"/"mueller") match. */
function variants(q: string): string[] {
  const n = normalize(q);
  const loose = n.replace(/ae/g, "a").replace(/oe/g, "o").replace(/ue/g, "u");
  return n === loose ? [n] : [n, loose];
}

export function searchPlaces(places: Place[], query: string, limit = 30): Place[] {
  const qs = variants(query).filter(Boolean);
  if (!qs.length) return [];
  const scored: { p: Place; s: number }[] = [];
  for (const p of places) {
    const cat = CATEGORY_BY_ID[p.cat];
    const name = normalize(p.name);
    const nameLoose = name.replace(/ae/g, "a").replace(/oe/g, "o").replace(/ue/g, "u");
    const hay = normalize(`${p.address ?? ""} ${cat.label} ${cat.badge} ${p.kind}`);
    let s = 0;
    for (const q of qs) {
      if (name.startsWith(q) || nameLoose.startsWith(q)) s = Math.max(s, 3);
      else if (name.includes(q) || nameLoose.includes(q)) s = Math.max(s, 2);
      else if (q.split(" ").every((w) => hay.includes(w) || name.includes(w))) s = Math.max(s, 1);
    }
    if (s) scored.push({ p, s });
  }
  scored.sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name, "de"));
  return scored.slice(0, limit).map((x) => x.p);
}

import type { LatLon } from "./area";
import type { Place } from "./types";

/** OpenStreetMap walking directions (FOSSGIS OSRM, foot profile). */
export function directionsUrl(to: LatLon, from?: LatLon | null): string {
  const f = from ? `${from.lat.toFixed(5)},${from.lon.toFixed(5)}` : "";
  const t = `${to.lat.toFixed(5)},${to.lon.toFixed(5)}`;
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${encodeURIComponent(`${f};${t}`)}`;
}

/** Public transport route in Google Maps (BVG timetables); starts from the phone's location if none is given. */
export function transitUrl(to: LatLon, from?: LatLon | null): string {
  const q = new URLSearchParams({ api: "1", destination: `${to.lat.toFixed(5)},${to.lon.toFixed(5)}`, travelmode: "transit" });
  if (from) q.set("origin", `${from.lat.toFixed(5)},${from.lon.toFixed(5)}`);
  return `https://www.google.com/maps/dir/?${q}`;
}

export function osmUrl(p: Place): string {
  return `https://www.openstreetmap.org/${p.id}`;
}

export function ageLabel(p: Place): string | null {
  if (p.minAge != null && p.maxAge != null) return `Ages ${p.minAge}–${p.maxAge}`;
  if (p.minAge != null) return `Ages ${p.minAge}+`;
  if (p.maxAge != null) return `Up to ${p.maxAge}`;
  return null;
}

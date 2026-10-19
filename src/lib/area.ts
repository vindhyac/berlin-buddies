import type { Place } from "./types";

export interface LatLon {
  lat: number;
  lon: number;
}

/** Bounding box of Berlin, south,west,north,east (spec §3.3). */
export const BERLIN_BBOX = { south: 52.3383, west: 13.0884, north: 52.6755, east: 13.7612 } as const;
export const BERLIN_CENTER: LatLon = { lat: 52.517, lon: 13.389 };

export function distanceKm(a: LatLon, b: LatLon): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 100) * 10} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export interface Kiez {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** How far around the centre counts as "in" this Kiez */
  radiusKm: number;
}

/** Popular family neighbourhoods. Centres are approximate; radius keeps them tight. */
export const KIEZE: Kiez[] = [
  { id: "mitte", name: "Mitte", lat: 52.5208, lon: 13.4049, radiusKm: 2 },
  { id: "prenzlauer-berg", name: "Prenzlauer Berg", lat: 52.5387, lon: 13.4247, radiusKm: 1.8 },
  { id: "friedrichshain", name: "Friedrichshain", lat: 52.5145, lon: 13.4539, radiusKm: 1.8 },
  { id: "kreuzberg", name: "Kreuzberg", lat: 52.4977, lon: 13.4115, radiusKm: 1.9 },
  { id: "neukoelln", name: "Neukölln", lat: 52.4811, lon: 13.4353, radiusKm: 1.8 },
  { id: "schoeneberg", name: "Schöneberg", lat: 52.4842, lon: 13.3517, radiusKm: 1.8 },
  { id: "charlottenburg", name: "Charlottenburg", lat: 52.5167, lon: 13.3041, radiusKm: 2 },
  { id: "wedding", name: "Wedding", lat: 52.5486, lon: 13.3567, radiusKm: 1.8 },
  { id: "moabit", name: "Moabit", lat: 52.5276, lon: 13.3366, radiusKm: 1.4 },
  { id: "pankow", name: "Pankow", lat: 52.5693, lon: 13.4018, radiusKm: 2 },
  { id: "lichtenberg", name: "Lichtenberg", lat: 52.5153, lon: 13.4993, radiusKm: 2 },
  { id: "treptow", name: "Treptow", lat: 52.4893, lon: 13.4667, radiusKm: 2 },
  { id: "tempelhof", name: "Tempelhof", lat: 52.4664, lon: 13.3858, radiusKm: 2 },
  { id: "steglitz", name: "Steglitz", lat: 52.4566, lon: 13.3221, radiusKm: 2 },
  { id: "zehlendorf", name: "Zehlendorf", lat: 52.4339, lon: 13.2587, radiusKm: 2.5 },
  { id: "spandau", name: "Spandau", lat: 52.5363, lon: 13.2016, radiusKm: 2.5 },
  { id: "koepenick", name: "Köpenick", lat: 52.4446, lon: 13.5747, radiusKm: 2.5 },
  { id: "marzahn", name: "Marzahn", lat: 52.5446, lon: 13.5643, radiusKm: 2.5 },
];

export type Area =
  | { kind: "all" }
  | { kind: "near"; radiusKm: 1 | 2 | 5 }
  | { kind: "kiez"; kiezId: string };

/** Where distances are measured from for the current area, if anywhere. */
export function areaOrigin(area: Area, me: LatLon | null): LatLon | null {
  if (area.kind === "near") return me;
  if (area.kind === "kiez") {
    const k = KIEZE.find((k) => k.id === area.kiezId);
    return k ? { lat: k.lat, lon: k.lon } : null;
  }
  return me;
}

export type WithDistance<T> = T & { distanceKm?: number };

export interface PlaceWithDistance extends Place {
  distanceKm?: number;
}

/**
 * Apply the area picker. "All Berlin" keeps everything. "Near me" and a Kiez keep
 * places inside the radius and sort them by distance, closest first.
 * "Near me" without a known location keeps everything (the UI asks for location).
 */
export function filterByArea<T extends LatLon>(places: T[], area: Area, me: LatLon | null): WithDistance<T>[] {
  const origin = areaOrigin(area, me);
  if (!origin) return places;
  const withD = places.map((p) => ({ ...p, distanceKm: distanceKm(origin, p) }));
  if (area.kind === "all") return withD;
  const radius = area.kind === "near" ? area.radiusKm : KIEZE.find((k) => k.id === area.kiezId)!.radiusKm;
  return withD.filter((p) => p.distanceKm! <= radius).sort((a, b) => a.distanceKm! - b.distanceKm!);
}

export function insideBerlinBox(p: LatLon): boolean {
  return p.lat >= BERLIN_BBOX.south && p.lat <= BERLIN_BBOX.north && p.lon >= BERLIN_BBOX.west && p.lon <= BERLIN_BBOX.east;
}

export type CategoryId = "animals" | "water" | "play" | "park" | "museum" | "science";

/** A cleaned-up OpenStreetMap place, as sent from the server to the browser. */
export interface Place {
  /** OSM id like "node/123" or "way/456" */
  id: string;
  name: string;
  cat: CategoryId;
  /** Short human label of what it is, e.g. "Playground", "Petting zoo" */
  kind: string;
  lat: number;
  lon: number;
  address?: string;
  website?: string;
  wikidata?: string;
  wikipedia?: string;
  /** true when OSM has an image / wikimedia_commons tag */
  hasPhotoTag?: boolean;
  fee?: "yes" | "no";
  wheelchair?: "yes" | "limited" | "no";
  minAge?: number;
  maxAge?: number;
  hours?: string;
  indoor?: boolean;
}

export interface PlacesResponse {
  places: Place[];
  source: "live" | "cache" | "fallback";
  mirror?: string;
  fetchedAt: string;
  rawCount?: number;
}

export interface PlaceDetails {
  summary?: string;
  wikiUrl?: string;
  wikiTitle?: string;
  photo?: {
    url: string;
    pageUrl: string;
    artist?: string;
    license?: string;
  };
  google?: { rating: number; count: number; url?: string };
}

export interface UserList {
  id: string;
  name: string;
  emoji: string;
  ids: string[];
  builtin?: boolean;
}

/** A family event from visitBerlin's children's calendar, as sent from the server to the browser. */
export interface KidEvent {
  /** "vb:<slug>" */
  id: string;
  name: string;
  /** visitBerlin page, always linked for credit and full details */
  url: string;
  /** e.g. "Theatre", "Exhibition", "Workshop" */
  kind: string;
  /** Berlin local time, "YYYY-MM-DDTHH:mm" */
  start: string;
  end?: string;
  /** false when visitBerlin gives midnight, i.e. no real start time */
  hasTime: boolean;
  /** Permanent or runs for weeks: shown in "Ongoing", not by date */
  ongoing: boolean;
  venue: string;
  address?: string;
  lat: number;
  lon: number;
  image?: string;
  /** Short excerpt only; the full text stays on visitBerlin */
  excerpt?: string;
  ticketUrl?: string;
}

export interface EventsResponse {
  events: KidEvent[];
  source: "live" | "cache" | "unavailable";
  fetchedAt: string;
}

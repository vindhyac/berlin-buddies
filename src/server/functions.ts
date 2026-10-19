import { createServerFn } from "@tanstack/react-start";
import type { CategoryId } from "../lib/types";
import { loadBerlinFamilyPlaces } from "./overpass";
import { loadKidEvents } from "./visitberlin";
import { loadPlaceDetails, type DetailsInput } from "./wiki";

/** The only way OSM data reaches the app (spec §8). */
export const getBerlinFamilyPlaces = createServerFn({ method: "GET" }).handler(() => loadBerlinFamilyPlaces());

/** Kids' events from visitBerlin for the next 7 days, plus ongoing exhibitions. */
export const getKidEvents = createServerFn({ method: "GET" }).handler(() => loadKidEvents());

const CATS: CategoryId[] = ["animals", "water", "play", "park", "museum", "science"];

export const getPlaceDetails = createServerFn({ method: "POST" })
  .validator((d: DetailsInput): DetailsInput => {
    if (!d || typeof d.name !== "string" || typeof d.id !== "string") throw new Error("Missing place");
    if (!Number.isFinite(d.lat) || !Number.isFinite(d.lon)) throw new Error("Missing coordinates");
    return {
      id: d.id.slice(0, 40),
      name: d.name.slice(0, 200),
      cat: CATS.includes(d.cat) ? d.cat : "park",
      lat: d.lat,
      lon: d.lon,
      wikidata: d.wikidata?.slice(0, 20),
      wikipedia: d.wikipedia?.slice(0, 200),
    };
  })
  .handler(({ data }) => loadPlaceDetails(data));

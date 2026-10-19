/**
 * Saves places (OpenStreetMap) and kids' events (visitBerlin) as static JSON in public/data/.
 * Run by the GitHub Action every few hours, so visitors never wait for the slow live fetches.
 * A failed source keeps its previous file instead of overwriting it with a fallback.
 *
 *   npm run refresh-data
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { loadBerlinFamilyPlaces } from "../src/server/overpass";
import { loadKidEvents } from "../src/server/visitberlin";

const dir = new URL("../public/data/", import.meta.url);
mkdirSync(dir, { recursive: true });
const save = (name: string, value: unknown) => writeFileSync(new URL(name, dir), `${JSON.stringify(value)}\n`);

const [places, events] = await Promise.all([loadBerlinFamilyPlaces(), loadKidEvents()]);
let failed = 0;

if (places.source === "fallback") {
  console.error("Places: every Overpass mirror failed, keeping the previous file.");
  failed++;
} else {
  save("places.json", { ...places, source: "live" });
  console.log(`Places: ${places.places.length}`);
}

if (events.source === "unavailable") {
  console.error("Events: visitBerlin unreachable, keeping the previous file.");
  failed++;
} else {
  save("events.json", events);
  console.log(`Events: ${events.events.length} (${events.events.filter((e) => !e.ongoing).length} dated)`);
}

process.exit(failed === 2 ? 1 : 0);

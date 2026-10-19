import type { Place } from "../lib/types";

/**
 * 14 hand-picked spots shown only when every Overpass mirror fails (spec §3.1).
 * Ids are placeholders in a range OSM won't reach soon, so they never clash with live ids.
 */
export const FALLBACK_PLACES: Place[] = [
  { id: "node/90000000001", name: "Zoo Berlin", cat: "animals", kind: "Zoo", lat: 52.5079, lon: 13.3377, address: "Hardenbergplatz 8, 10787 Berlin", website: "https://www.zoo-berlin.de", wikipedia: "de:Zoologischer Garten Berlin", fee: "yes", wheelchair: "yes" },
  { id: "node/90000000002", name: "Tierpark Berlin", cat: "animals", kind: "Zoo", lat: 52.5024, lon: 13.5307, address: "Am Tierpark 125, 10319 Berlin", website: "https://www.tierpark-berlin.de", wikipedia: "de:Tierpark Berlin", fee: "yes", wheelchair: "yes" },
  { id: "node/90000000003", name: "Kinderbauernhof Görlitzer Park", cat: "animals", kind: "City farm", lat: 52.4958, lon: 13.4372, address: "Wiener Straße 59, 10999 Berlin", fee: "no" },
  { id: "node/90000000004", name: "Museum für Naturkunde", cat: "science", kind: "Natural history museum", lat: 52.5300, lon: 13.3795, address: "Invalidenstraße 43, 10115 Berlin", website: "https://www.museumfuernaturkunde.berlin", wikipedia: "de:Museum für Naturkunde (Berlin)", fee: "yes", wheelchair: "yes", indoor: true },
  { id: "node/90000000005", name: "Deutsches Technikmuseum", cat: "science", kind: "Technology museum", lat: 52.4986, lon: 13.3779, address: "Trebbiner Straße 9, 10963 Berlin", website: "https://technikmuseum.berlin", wikipedia: "de:Deutsches Technikmuseum", fee: "yes", wheelchair: "yes", indoor: true },
  { id: "node/90000000006", name: "Zeiss-Großplanetarium", cat: "science", kind: "Planetarium", lat: 52.5426, lon: 13.4255, address: "Prenzlauer Allee 80, 10405 Berlin", website: "https://www.planetarium.berlin", wikipedia: "de:Zeiss-Großplanetarium", fee: "yes", indoor: true },
  { id: "node/90000000007", name: "Labyrinth Kindermuseum", cat: "museum", kind: "Museum", lat: 52.5566, lon: 13.3727, address: "Osloer Straße 12, 13359 Berlin", website: "https://www.labyrinth-kindermuseum.de", fee: "yes", minAge: 3, maxAge: 11, indoor: true },
  { id: "node/90000000008", name: "MACHmit! Museum für Kinder", cat: "museum", kind: "Museum", lat: 52.5436, lon: 13.4183, address: "Senefelderstraße 5, 10437 Berlin", website: "https://www.machmitmuseum.de", fee: "yes", indoor: true },
  { id: "node/90000000009", name: "Tempelhofer Feld", cat: "park", kind: "Park", lat: 52.4730, lon: 13.4030, wikipedia: "de:Tempelhofer Feld", fee: "no", wheelchair: "yes" },
  { id: "node/90000000010", name: "Britzer Garten", cat: "park", kind: "Park", lat: 52.4300, lon: 13.4180, website: "https://gruen-berlin.de/britzer-garten", wikipedia: "de:Britzer Garten", fee: "yes", wheelchair: "yes" },
  { id: "node/90000000011", name: "Gärten der Welt", cat: "park", kind: "Park", lat: 52.5390, lon: 13.5770, website: "https://gruen-berlin.de/gaerten-der-welt", wikipedia: "de:Gärten der Welt", fee: "yes" },
  { id: "node/90000000012", name: "Stadtbad Neukölln", cat: "water", kind: "Indoor pool", lat: 52.4811, lon: 13.4366, address: "Ganghoferstraße 3, 12043 Berlin", website: "https://www.berlinerbaeder.de", wikipedia: "de:Stadtbad Neukölln", fee: "yes", indoor: true },
  { id: "node/90000000013", name: "Sommerbad Kreuzberg", cat: "water", kind: "Outdoor pool", lat: 52.4978, lon: 13.4088, address: "Prinzenstraße 113, 10969 Berlin", website: "https://www.berlinerbaeder.de", wikipedia: "de:Sommerbad Kreuzberg", fee: "yes" },
  { id: "node/90000000014", name: "Spielplatz Kollwitzplatz", cat: "play", kind: "Playground", lat: 52.5363, lon: 13.4174, address: "Kollwitzplatz, 10405 Berlin", fee: "no" },
];

import { describe, expect, it } from "vitest";
import { decodeList, encodeList } from "./lists";
import { normalize, searchPlaces } from "./search";
import type { Place } from "./types";

const places: Place[] = [
  { id: "node/1", name: "Spielplatz Görlitzer Park", cat: "play", kind: "Playground", lat: 0, lon: 0, address: "Wiener Straße 1" },
  { id: "way/2", name: "Stadtbad Neukölln", cat: "water", kind: "Indoor pool", lat: 0, lon: 0 },
  { id: "node/3", name: "Zoo Berlin", cat: "animals", kind: "Zoo", lat: 0, lon: 0 },
];

describe("search", () => {
  it("folds German letters", () => expect(normalize("Größe Straße")).toBe("groesse strasse"));
  it("finds umlaut names typed without umlauts", () => {
    expect(searchPlaces(places, "gorlitzer")[0].id).toBe("node/1");
    expect(searchPlaces(places, "goerlitzer")[0].id).toBe("node/1");
    expect(searchPlaces(places, "neukolln")[0].id).toBe("way/2");
  });
  it("matches category words and addresses", () => {
    expect(searchPlaces(places, "splash").map((p) => p.id)).toContain("way/2");
    expect(searchPlaces(places, "wiener")[0].id).toBe("node/1");
  });
});

describe("list sharing", () => {
  it("round-trips name, emoji and ids", () => {
    const enc = encodeList({ id: "x", name: "Rainy Sunday ☔", emoji: "🦖", ids: ["node/1", "way/2", "relation/99"] });
    expect(enc).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeList(enc)).toEqual({ name: "Rainy Sunday ☔", emoji: "🦖", ids: ["node/1", "way/2", "relation/99"] });
  });
  it("rejects junk", () => expect(decodeList("not-a-list")).toBeNull());
});

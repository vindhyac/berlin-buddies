import { describe, expect, it } from "vitest";
import { distanceKm, filterByArea, formatDistance, KIEZE } from "./area";
import type { Place } from "./types";

const p = (id: string, lat: number, lon: number): Place => ({ id: `node/${id}`, name: id, cat: "park", kind: "Park", lat, lon });
const alex = { lat: 52.5219, lon: 13.4132 };
const places = [
  p("near", 52.5225, 13.414), // ~80 m from Alexanderplatz
  p("mid", 52.5309, 13.4132), // ~1 km north
  p("far", 52.4573, 13.4132), // ~7 km south
];

describe("distanceKm", () => {
  it("measures Alexanderplatz → Brandenburger Tor as about 2.5 km", () => {
    expect(distanceKm(alex, { lat: 52.5163, lon: 13.3777 })).toBeCloseTo(2.48, 1);
  });
  it("is zero for the same point", () => expect(distanceKm(alex, alex)).toBe(0));
});

describe("filterByArea", () => {
  it("All Berlin keeps everything and adds distances when location is known", () => {
    const out = filterByArea(places, { kind: "all" }, alex);
    expect(out).toHaveLength(3);
    expect(out[0].distanceKm).toBeLessThan(0.2);
  });
  it("All Berlin without location keeps everything, no distances", () => {
    const out = filterByArea(places, { kind: "all" }, null);
    expect(out).toHaveLength(3);
    expect(out[0].distanceKm).toBeUndefined();
  });
  it("Near me keeps places inside the radius, closest first", () => {
    const oneKm = filterByArea(places, { kind: "near", radiusKm: 1 }, alex).map((x) => x.name);
    expect(oneKm[0]).toBe("near");
    expect(oneKm).not.toContain("far");
    expect(filterByArea(places, { kind: "near", radiusKm: 2 }, alex).map((x) => x.name)).toEqual(["near", "mid"]);
    expect(filterByArea(places, { kind: "near", radiusKm: 5 }, alex).map((x) => x.name)).toEqual(["near", "mid"]);
  });
  it("Near me without a location keeps everything", () => {
    expect(filterByArea(places, { kind: "near", radiusKm: 1 }, null)).toHaveLength(3);
  });
  it("A Kiez measures from its own centre, not from me", () => {
    const mitte = KIEZE.find((k) => k.id === "mitte")!;
    const out = filterByArea(places, { kind: "kiez", kiezId: "mitte" }, { lat: 52.4, lon: 13.2 });
    expect(out.every((x) => x.distanceKm! <= mitte.radiusKm)).toBe(true);
    expect(out.map((x) => x.name)).not.toContain("far");
  });
  it("every Kiez sits inside Berlin", () => {
    for (const k of KIEZE) {
      expect(k.lat).toBeGreaterThan(52.33);
      expect(k.lat).toBeLessThan(52.68);
    }
  });
});

describe("formatDistance", () => {
  it("uses metres under 1 km and km above", () => {
    expect(formatDistance(0.34)).toBe("340 m");
    expect(formatDistance(2.345)).toBe("2.3 km");
    expect(formatDistance(12.6)).toBe("13 km");
  });
});

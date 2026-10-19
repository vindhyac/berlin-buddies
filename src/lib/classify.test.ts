import { describe, expect, it } from "vitest";
import { classify, rejectReason, toPlace } from "./classify";

const today = new Date("2026-10-14");

describe("quality filters", () => {
  it("drops unnamed, private and closed places", () => {
    expect(rejectReason({ leisure: "playground" }, today)).toBe("no-name");
    expect(rejectReason({ name: "X", access: "private" }, today)).toBe("private");
    expect(rejectReason({ name: "X", operational_status: "closed" }, today)).toBe("closed");
    expect(rejectReason({ name: "X", opening_hours: "off" }, today)).toBe("closed");
    expect(rejectReason({ name: "X", end_date: "2019" }, today)).toBe("ended");
    expect(rejectReason({ name: "X", "disused:amenity": "public_bath" }, today)).toBe("gone");
    expect(rejectReason({ name: "X", "was:leisure": "playground" }, today)).toBe("gone");
  });
  it("keeps open places, including ones with a future end date", () => {
    expect(rejectReason({ name: "X", end_date: "2030-01" }, today)).toBeNull();
    expect(rejectReason({ name: "X", access: "yes" }, today)).toBeNull();
  });
});

describe("classify", () => {
  it("sorts places into the six categories", () => {
    expect(classify({ tourism: "zoo", zoo: "petting_zoo" })).toEqual({ cat: "animals", kind: "Petting zoo" });
    expect(classify({ name: "Kinderbauernhof Pinke-Panke", leisure: "park" })?.cat).toBe("animals");
    expect(classify({ amenity: "public_bath" })?.cat).toBe("water");
    expect(classify({ leisure: "sports_centre", sport: "swimming" })?.cat).toBe("water");
    expect(classify({ leisure: "playground" })?.cat).toBe("play");
    expect(classify({ leisure: "park" })?.cat).toBe("park");
    expect(classify({ tourism: "museum" })?.cat).toBe("museum");
    expect(classify({ tourism: "museum", museum: "technology" })?.cat).toBe("science");
    expect(classify({ amenity: "planetarium" })?.cat).toBe("science");
    expect(classify({ amenity: "ice_cream" })).toBeNull();
  });
  it("builds a place from a way with a centre", () => {
    const pl = toPlace({ type: "way", id: 7, center: { lat: 52.5, lon: 13.4 }, tags: { name: "Volkspark", leisure: "park", fee: "no", wheelchair: "yes", min_age: "3" } }, today);
    expect(pl).toMatchObject({ id: "way/7", cat: "park", fee: "no", wheelchair: "yes", minAge: 3 });
  });
});

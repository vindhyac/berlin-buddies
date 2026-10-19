import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { KidEvent } from "../lib/types";
import { addDays, inWindow } from "../lib/events";
import { excerpt, parseEvent, parseListing } from "./visitberlin";

const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");
const EVENT_URL = "https://www.visitberlin.de/en/event/little-lord-fauntleroy-musical-1";

describe("parseListing", () => {
  it("reads event URLs in listing order", () => {
    const urls = parseListing(fixture("vb-listing.html"));
    expect(urls.length).toBe(21);
    expect(urls[0]).toBe("https://www.visitberlin.de/en/event/eat-smart-apple-cinnamon");
    expect(urls.every((u) => u.startsWith("https://www.visitberlin.de/en/event/"))).toBe(true);
  });
  it("returns nothing for a page without JSON-LD", () => expect(parseListing("<html></html>")).toEqual([]));
});

describe("parseEvent", () => {
  const e = parseEvent(fixture("vb-event.html"), EVENT_URL)!;
  it("reads name, dates, venue and coordinates", () => {
    expect(e.id).toBe("vb:little-lord-fauntleroy-musical-1");
    expect(e.name).toBe("LITTLE LORD FAUNTLEROY – Musical");
    expect(e.kind).toBe("Theatre");
    expect(e.start).toBe("2026-11-13T19:30");
    expect(e.end).toBe("2026-12-30T19:30");
    expect(e.hasTime).toBe(true);
    expect(e.venue).toBe("BLUEMAX Theater");
    expect(e.address).toBe("Marlene-Dietrich-Platz 4, 10785 Berlin");
    expect(e.lat).toBeCloseTo(52.507, 3);
    expect(e.ticketUrl).toContain("showslot.com");
  });
  it("treats a six-week run as ongoing", () => expect(e.ongoing).toBe(true));
  it("keeps the description short", () => expect((e.excerpt ?? "").length).toBeLessThanOrEqual(241));
  it("skips pages without an Event", () => expect(parseEvent("<html></html>", EVENT_URL)).toBeNull());
});

describe("excerpt", () => {
  it("ends on a sentence when it can", () => {
    expect(excerpt("One two three. Four five six seven eight nine ten.", 24)).toBe("One two three.");
  });
  it("decodes entities", () => expect(excerpt("Kids&#039; &amp; parents")).toBe("Kids' & parents"));
});

describe("inWindow", () => {
  const ev = (start: string, end?: string): KidEvent => ({
    id: "vb:x", name: "x", url: "", kind: "", start, end, hasTime: false, ongoing: false, venue: "", lat: 0, lon: 0,
  });
  const today = "2026-10-15";
  it("keeps something on today", () => expect(inWindow(ev("2026-10-15T15:00"), today)).toBe(true));
  it("keeps day 7 but not day 8", () => {
    expect(inWindow(ev("2026-10-21T10:00"), today)).toBe(true);
    expect(inWindow(ev("2026-10-22T10:00"), today)).toBe(false);
  });
  it("keeps a run that started earlier and is still on", () => expect(inWindow(ev("2026-09-01T00:00", "2026-11-01T00:00"), today)).toBe(true));
  it("drops what has ended", () => expect(inWindow(ev("2026-10-01T00:00", "2026-10-14T00:00"), today)).toBe(false));
  it("adds days across a month end", () => expect(addDays("2026-10-30", 3)).toBe("2026-11-02"));
});

import { describe, expect, it } from "vitest";
import { dateStub, icsFor, matchesWhen, weekendRange, whenLabel } from "./events";
import type { KidEvent } from "./types";

const ev = (start: string, end?: string, extra: Partial<KidEvent> = {}): KidEvent => ({
  id: "vb:test",
  name: "Puppet show, for kids",
  url: "https://www.visitberlin.de/en/event/test",
  kind: "Theatre",
  start,
  end,
  hasTime: !start.endsWith("T00:00"),
  ongoing: false,
  venue: "Theater",
  address: "Street 1, 10115 Berlin",
  lat: 52.5,
  lon: 13.4,
  ...extra,
});
const thu = "2026-10-15";

describe("weekendRange", () => {
  it("on a weekday is the coming Sat–Sun", () => expect(weekendRange(thu)).toEqual(["2026-10-17", "2026-10-18"]));
  it("on Saturday is today and tomorrow", () => expect(weekendRange("2026-10-17")).toEqual(["2026-10-17", "2026-10-18"]));
  it("on Sunday is just today", () => expect(weekendRange("2026-10-18")).toEqual(["2026-10-18", "2026-10-18"]));
});

describe("matchesWhen", () => {
  it("today matches a run that started earlier", () => expect(matchesWhen(ev("2026-10-04T14:00", "2026-10-18T14:00"), "today", thu)).toBe(true));
  it("weekend skips a Friday one-off", () => expect(matchesWhen(ev("2026-10-16T10:00", "2026-10-16T11:00"), "weekend", thu)).toBe(false));
  it("weekend keeps a Sunday one-off", () => expect(matchesWhen(ev("2026-10-18T11:00"), "weekend", thu)).toBe(true));
  it("week stops after 7 days", () => expect(matchesWhen(ev("2026-10-22T11:00"), "week", thu)).toBe(false));
});

describe("labels", () => {
  it("one-off with time", () => expect(whenLabel(ev("2026-10-18T15:00", "2026-10-18T15:00"), thu)).toBe("Sun 18 Oct · 15:00"));
  it("run already on", () => expect(whenLabel(ev("2026-10-04T14:00", "2026-10-18T14:00"), thu)).toBe("On now · until Sun 18 Oct"));
  it("future run", () => expect(whenLabel(ev("2026-10-20T10:00", "2026-10-22T10:00"), thu)).toBe("Several dates · 20 Oct – 22 Oct"));
  it("stub shows the start day, or Until for runs already on", () => {
    expect(dateStub(ev("2026-10-18T15:00"), thu)).toEqual({ top: "Sun", big: "18", bottom: "Oct" });
    expect(dateStub(ev("2026-10-04T14:00", "2026-10-21T14:00"), thu)).toEqual({ top: "Until", big: "21", bottom: "Oct" });
  });
});

describe("icsFor", () => {
  it("timed one-off keeps its Berlin time and escapes commas", () => {
    const ics = icsFor(ev("2026-10-18T15:00", "2026-10-18T15:45"), thu, new Date("2026-10-15T10:00:00Z"));
    expect(ics).toContain("DTSTART;TZID=Europe/Berlin:20261018T150000");
    expect(ics).toContain("DURATION:PT45M");
    expect(ics).toContain("SUMMARY:Puppet show\\, for kids");
  });
  it("a run becomes an all-day entry on its next day", () => {
    const ics = icsFor(ev("2026-10-04T14:00", "2026-10-21T14:00"), thu);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261015");
    expect(ics).toContain("DTEND;VALUE=DATE:20261016");
  });
});

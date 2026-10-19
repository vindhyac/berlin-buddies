import type { KidEvent } from "./types";

/** How far ahead events are collected and shown. */
export const WINDOW_DAYS = 7;

export type When = "today" | "weekend" | "week";

export const WHENS: { id: When; label: string; emoji: string }[] = [
  { id: "today", label: "Today", emoji: "☀️" },
  { id: "weekend", label: "This weekend", emoji: "🎈" },
  { id: "week", label: "Next 7 days", emoji: "🗓️" },
];

/** Today in Berlin as YYYY-MM-DD. */
export function berlinToday(d = new Date()): string {
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday */
const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

/** The coming Saturday and Sunday; on a weekend, what's left of it. */
export function weekendRange(today: string): [string, string] {
  const wd = weekday(today);
  if (wd === 0) return [today, today];
  if (wd === 6) return [today, addDays(today, 1)];
  const sat = addDays(today, 6 - wd);
  return [sat, addDays(sat, 1)];
}

const firstDay = (e: KidEvent) => e.start.slice(0, 10);
const lastDay = (e: KidEvent) => (e.end ?? e.start).slice(0, 10);

/** true when the event's dates touch [from, to] (inclusive). */
const overlaps = (e: KidEvent, from: string, to: string) => firstDay(e) <= to && lastDay(e) >= from;

export function matchesWhen(e: KidEvent, when: When, today: string): boolean {
  if (when === "today") return overlaps(e, today, today);
  if (when === "weekend") return overlaps(e, ...weekendRange(today));
  return overlaps(e, today, addDays(today, 6));
}

/** A one-off on a single day, as opposed to a run with several dates. */
export const isSingleDay = (e: KidEvent) => firstDay(e) === lastDay(e);

/** Sort key: the first day it's on from today. */
export const nextDay = (e: KidEvent, today: string) => (firstDay(e) < today ? today : firstDay(e));

const fmt = (day: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });

/** Big date block on the ticket stub. */
export function dateStub(e: KidEvent, today: string): { top: string; big: string; bottom: string } {
  if (firstDay(e) < today) return { top: "Until", big: fmt(lastDay(e), { day: "numeric" }), bottom: fmt(lastDay(e), { month: "short" }) };
  const d = firstDay(e);
  return { top: fmt(d, { weekday: "short" }), big: fmt(d, { day: "numeric" }), bottom: fmt(d, { month: "short" }) };
}

export const timeOf = (e: KidEvent) => (e.hasTime ? e.start.slice(11, 16) : null);

/** "Sat 18 Oct · 15:00", "On now · until 29 Oct", "Several dates · 20–29 Oct". */
export function whenLabel(e: KidEvent, today: string): string {
  const t = timeOf(e);
  const day = (d: string) => fmt(d, { weekday: "short", day: "numeric", month: "short" });
  if (e.ongoing) return e.end ? `Ongoing · until ${fmt(lastDay(e), { day: "numeric", month: "short", year: "numeric" })}` : "Ongoing";
  if (isSingleDay(e)) return [firstDay(e) === today ? "Today" : day(firstDay(e)), t].filter(Boolean).join(" · ");
  if (firstDay(e) <= today) return `On now · until ${day(lastDay(e))}`;
  return `Several dates · ${fmt(firstDay(e), { day: "numeric", month: "short" })} – ${fmt(lastDay(e), { day: "numeric", month: "short" })}`;
}

// ---------- Add to calendar (.ics) ----------

const icsText = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");

/**
 * A calendar entry for the next day the event is on. Timed one-offs get their real time (Berlin);
 * runs and untimed events become an all-day entry, with a note to check the times on visitBerlin.
 */
export function icsFor(e: KidEvent, today: string, now = new Date()): string {
  const day = nextDay(e, today).replace(/-/g, "");
  const t = timeOf(e);
  const timed = t != null && isSingleDay(e);
  const when = timed
    ? [`DTSTART;TZID=Europe/Berlin:${day}T${t!.replace(":", "")}00`, `DURATION:PT${e.end && e.end > e.start ? Math.max(30, (Date.parse(e.end) - Date.parse(e.start)) / 60000) : 60}M`]
    : [`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${addDays(nextDay(e, today), 1).replace(/-/g, "")}`];
  const note = [timed ? null : "Check times and dates on visitBerlin.", e.url].filter(Boolean).join("\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Berlin Buddies//Events//EN",
    "BEGIN:VEVENT",
    `UID:${e.id}-${day}@berlin-buddies`,
    `DTSTAMP:${stamp(now)}`,
    ...when,
    `SUMMARY:${icsText(e.name)}`,
    `LOCATION:${icsText([e.venue, e.address].filter(Boolean).join(", "))}`,
    `GEO:${e.lat.toFixed(6)};${e.lon.toFixed(6)}`,
    `DESCRIPTION:${icsText(note)}`,
    `URL:${e.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Keep events that are on at some point in [today, today + 7 days). */
export function inWindow(e: KidEvent, today: string, windowDays = WINDOW_DAYS): boolean {
  return (e.end ?? e.start).slice(0, 10) >= today && e.start.slice(0, 10) < addDays(today, windowDays);
}

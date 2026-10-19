import { useState } from "react";
import { CalendarPlus, ChevronDown, ExternalLink, Heart, LocateFixed, MapPin, Navigation, TrainFront, X } from "lucide-react";
import { distanceKm, formatDistance, type LatLon, type WithDistance } from "../lib/area";
import { WHENS, dateStub, icsFor, whenLabel, type When } from "../lib/events";
import { directionsUrl, transitUrl } from "../lib/links";
import { FAVORITES_ID } from "../lib/lists";
import type { KidEvent, UserList } from "../lib/types";

export const EVENT_EMOJI = "🎟️";

// ---------- Places / Events tabs ----------

export type View = "places" | "events";

export function ViewTabs({ view, setView, eventCount }: { view: View; setView: (v: View) => void; eventCount: number | null }) {
  return (
    <div className="view-tabs" role="tablist" aria-label="What to show">
      <button role="tab" aria-selected={view === "places"} onClick={() => setView("places")}>
        🗺️ Places
      </button>
      <button role="tab" aria-selected={view === "events"} onClick={() => setView("events")}>
        {EVENT_EMOJI} Events
        {eventCount != null && <span className="hand tabular-nums">{eventCount}</span>}
      </button>
    </div>
  );
}

export function WhenChips({
  when,
  setWhen,
  counts,
  className = "flex-wrap",
}: {
  when: When;
  setWhen: (w: When) => void;
  counts: Record<When, number>;
  className?: string;
}) {
  return (
    <div className={`flex gap-1.5 ${className}`}>
      {WHENS.map((w) => (
        <button key={w.id} className="pill" aria-pressed={when === w.id} onClick={() => setWhen(w.id)}>
          {w.emoji} {w.label} <span className="text-xs tabular-nums opacity-70">{counts[w.id]}</span>
        </button>
      ))}
    </div>
  );
}

// ---------- Ticket-stub card in the sidebar ----------

export function EventRow({
  e,
  today,
  selected,
  saved,
  onClick,
}: {
  e: WithDistance<KidEvent>;
  today: string;
  selected: boolean;
  saved: boolean;
  onClick: () => void;
}) {
  const stub = dateStub(e, today);
  return (
    <li>
      <button className={`ticket ${selected ? "is-selected" : ""}`} onClick={onClick} aria-current={selected || undefined}>
        <span className="ticket-stub" aria-hidden>
          {e.ongoing ? (
            <span className="text-2xl">🖼️</span>
          ) : (
            <>
              <span className="ticket-top">{stub.top}</span>
              <span className="ticket-big">{stub.big}</span>
              <span className="ticket-top">{stub.bottom}</span>
            </>
          )}
        </span>
        <span className="min-w-0 flex-1 py-2 pl-3 pr-2">
          <span className="line-clamp-2 font-semibold leading-tight">
            {saved && <span aria-label="Saved">❤️ </span>}
            {e.name}
          </span>
          <span className="mt-0.5 block truncate text-xs text-ink-soft">
            {e.kind} · {e.venue}
          </span>
          <span className="mt-0.5 flex items-center justify-between gap-2 text-xs font-semibold">
            <span className="truncate">{whenLabel(e, today)}</span>
            {e.distanceKm != null && <span className="shrink-0 tabular-nums text-ink-soft">{formatDistance(e.distanceKm)}</span>}
          </span>
        </span>
      </button>
    </li>
  );
}

/** Long-running exhibitions, folded away so they don't crowd the dated events. */
export function OngoingSection({ children, count }: { children: React.ReactNode; count: number }) {
  const [open, setOpen] = useState(false);
  if (!count) return null;
  return (
    <section className="flex flex-col gap-1">
      <button className="flex items-center justify-between gap-2 py-1 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>
          <span className="text-lg font-semibold">🖼️ Ongoing for kids</span>
          <span className="block text-xs text-ink-soft">Exhibitions and long runs, any day you like</span>
        </span>
        <span className="flex items-center gap-1 text-ink-soft">
          <span className="hand text-base tabular-nums">{count}</span>
          <ChevronDown size={18} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && <ul className="flex flex-col gap-2.5 pt-1">{children}</ul>}
    </section>
  );
}

// ---------- Details panel ----------

function downloadIcs(e: KidEvent, today: string) {
  const blob = new Blob([icsFor(e, today)], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${e.id.replace(/^vb:/, "")}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

interface CardProps {
  event: KidEvent;
  today: string;
  lists: UserList[];
  me: LatLon | null;
  locating: boolean;
  onLocate: () => void;
  onToggle: (listId: string, id: string) => void;
  onClose: () => void;
}

export function EventCard({ event: e, today, lists, me, locating, onLocate, onToggle, onClose }: CardProps) {
  const [imgOk, setImgOk] = useState(true);
  const saved = lists.find((l) => l.id === FAVORITES_ID)?.ids.includes(e.id) ?? false;
  const dist = me ? distanceKm(me, e) : null;

  return (
    <article className="place-card relative flex max-h-full flex-col overflow-hidden" aria-label={e.name}>
      <button
        onClick={onClose}
        className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border-2 border-ink bg-paper text-ink"
        aria-label="Close event"
      >
        <X size={18} />
      </button>

      <div className="photo-frame relative aspect-[5/2] w-full shrink-0 overflow-hidden lg:aspect-[16/9]">
        {e.image && imgOk ? (
          <img src={e.image} alt="" className="h-full w-full object-cover" loading="lazy" onError={() => setImgOk(false)} />
        ) : (
          <div className="grid h-full w-full place-items-center bg-honey-soft">
            <span className="text-6xl" aria-hidden>
              {EVENT_EMOJI}
            </span>
          </div>
        )}
        <span className="date-tape">{whenLabel(e, today)}</span>
      </div>

      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4">
        <div>
          <p className="eyebrow">{e.kind}</p>
          <h2 className="text-2xl font-semibold leading-tight text-ink">{e.name}</h2>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-soft">
            <MapPin size={15} className="mt-0.5 shrink-0" />
            <span>
              <strong className="text-ink">{e.venue}</strong>
              {e.address && `, ${e.address}`}
              {dist != null && (
                <>
                  {" · "}
                  <strong className="text-ink">{formatDistance(dist)} away</strong>
                </>
              )}
            </span>
          </p>
        </div>

        {e.excerpt && <p className="text-[0.92rem] leading-relaxed">{e.excerpt}</p>}
        {!e.ongoing && !(e.start.slice(0, 10) === (e.end ?? e.start).slice(0, 10)) && (
          <p className="text-sm text-ink-soft">This runs on several days. Check the exact dates and times on visitBerlin.</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button className="pill" aria-pressed={saved} onClick={() => onToggle(FAVORITES_ID, e.id)}>
            <Heart size={15} fill={saved ? "currentColor" : "none"} className={saved ? "text-stamp" : ""} /> {saved ? "Saved" : "Save"}
          </button>
          <button className="pill" onClick={() => downloadIcs(e, today)}>
            <CalendarPlus size={15} /> Add to calendar
          </button>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <a className="btn btn-primary" href={transitUrl(e, me)} target="_blank" rel="noopener">
            <TrainFront size={16} /> By U-/S-Bahn
          </a>
          <a className="btn" href={directionsUrl(e, me)} target="_blank" rel="noopener">
            <Navigation size={16} /> Walk there
          </a>
          {!me && (
            <button className="btn" onClick={onLocate} disabled={locating}>
              <LocateFixed size={16} /> {locating ? "Finding you…" : "Use my location"}
            </button>
          )}
          <a className="btn btn-honey" href={e.url} target="_blank" rel="noopener">
            <ExternalLink size={16} /> Tickets & info
          </a>
        </div>

        <p className="text-[0.7rem] text-ink-soft">
          Event details and photo via{" "}
          <a href={e.url} target="_blank" rel="noopener" className="underline">
            visitBerlin
          </a>
          .
        </p>
      </div>
    </article>
  );
}

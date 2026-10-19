import { useMemo, useState } from "react";
import { LocateFixed, Plus, Search, X } from "lucide-react";
import { CAT_ICON, CatSticker, catInk } from "../lib/icons";
import { KIEZE, formatDistance, type Area } from "../lib/area";
import { CATEGORIES, CATEGORY_BY_ID, MOODS } from "../lib/categories";
import { searchPlaces } from "../lib/search";
import type { CategoryId, Place, UserList } from "../lib/types";
import type { PlaceWithDistance } from "../lib/area";

// ---------- Search ----------

export function SearchBox({
  places,
  onPick,
  idSuffix,
  onFocus,
}: {
  places: Place[];
  onPick: (p: Place) => void;
  idSuffix: string;
  onFocus?: () => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const results = useMemo(() => (q.trim().length >= 2 ? searchPlaces(places, q) : []), [places, q]);
  const listId = `search-results-${idSuffix}`;

  const pick = (p: Place) => {
    onPick(p);
    setOpen(false);
    setQ("");
  };

  return (
    <div className="relative">
      <div className="search flex items-center gap-2 px-3 py-2">
        <Search size={18} className="shrink-0 text-ink" aria-hidden />
        <input
          id={`search-${idSuffix}`}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => {
            setOpen(true);
            onFocus?.();
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => Math.min(a + 1, results.length - 1)));
            else if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
            else if (e.key === "Enter" && results[active]) pick(results[active]);
            else if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search playgrounds, pools, animals..."
          aria-label="Search places"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          autoComplete="off"
        />
        {q && (
          <button onClick={() => setQ("")} aria-label="Clear search" className="text-ink-soft">
            <X size={16} />
          </button>
        )}
      </div>
      {open && q.trim().length >= 2 && (
        <ul id={listId} role="listbox" className="search-results absolute left-0 right-0 top-full z-[600] mt-2 max-h-[60vh] overflow-y-auto p-1">
          {results.length === 0 && <li className="px-3 py-2 text-sm text-ink-soft">No places match “{q}”.</li>}
          {results.map((p, i) => {
            const c = CATEGORY_BY_ID[p.cat];
            return (
              <li
                key={p.id}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(p)}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 ${i === active ? "bg-honey-soft" : ""}`}
              >
                <CatSticker id={p.cat} color={c.color} size={26} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="block truncate text-xs text-ink-soft">{[p.kind, p.address].filter(Boolean).join(" · ")}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------- Area picker ----------

export function AreaPicker({
  area,
  setArea,
  hasLocation,
  locating,
  onLocate,
  idSuffix,
}: {
  area: Area;
  setArea: (a: Area) => void;
  hasLocation: boolean;
  locating: boolean;
  onLocate: () => void;
  idSuffix: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <button className="pill" aria-pressed={area.kind === "all"} onClick={() => setArea({ kind: "all" })}>
          🗺️ All Berlin
        </button>
        <button
          className="pill"
          aria-pressed={area.kind === "near"}
          onClick={() => {
            if (!hasLocation) onLocate();
            setArea({ kind: "near", radiusKm: area.kind === "near" ? area.radiusKm : 2 });
          }}
        >
          <LocateFixed size={14} /> {locating ? "Finding you…" : "Near me"}
        </button>
        <label htmlFor={`kiez-${idSuffix}`} className="sr-only">
          Pick a neighbourhood
        </label>
        <select
          id={`kiez-${idSuffix}`}
          className="pill appearance-none pr-3"
          aria-pressed={area.kind === "kiez"}
          value={area.kind === "kiez" ? area.kiezId : ""}
          onChange={(e) => setArea(e.target.value ? { kind: "kiez", kiezId: e.target.value } : { kind: "all" })}
        >
          <option value="">🏘️ Pick a Kiez…</option>
          {KIEZE.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
      </div>
      {area.kind === "near" && (
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-ink-soft">Within</span>
          {([1, 2, 5] as const).map((r) => (
            <button key={r} className="pill !py-1" aria-pressed={area.radiusKm === r} onClick={() => setArea({ kind: "near", radiusKm: r })}>
              {r} km
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Category cards ----------

interface CategoryProps {
  active: Set<CategoryId>;
  toggle: (id: CategoryId) => void;
  counts: Record<CategoryId, number>;
  className?: string;
}

/** Card order follows the mockup: the four core badges first. */
const CARD_ORDER: CategoryId[] = ["play", "water", "animals", "museum", "park", "science"];

/** Crayon-coloured blobs in a grid, for the full sidebar sheet. */
export function CategoryCards({ active, toggle, counts, className = "" }: CategoryProps) {
  return (
    <div className={`grid grid-cols-2 gap-x-3 gap-y-3.5 ${className}`}>
      {CARD_ORDER.map((id) => {
        const c = CATEGORY_BY_ID[id];
        const Icon = CAT_ICON[id];
        return (
          <button
            key={id}
            className="cat-card"
            style={{ ["--c" as any]: c.color, ["--fg" as any]: catInk(id) }}
            aria-pressed={active.has(id)}
            onClick={() => toggle(id)}
            title={`${c.badge} badge`}
          >
            <span className="label">{c.label}</span>
            <span className="icon" aria-hidden>
              <Icon size={34} strokeWidth={1.8} />
            </span>
            <span className="count">{counts[id].toLocaleString("de-DE")}</span>
          </button>
        );
      })}
    </div>
  );
}

/** One-line strip of the same categories, for the collapsed phone drawer. */
export function CategoryChips({ active, toggle, counts, className = "" }: CategoryProps) {
  return (
    <div className={`flex gap-1.5 ${className}`}>
      {CATEGORIES.map((c) => {
        const Icon = CAT_ICON[c.id];
        return (
          <button
            key={c.id}
            className="cat-chip"
            style={{ ["--c" as any]: c.color }}
            aria-pressed={active.has(c.id)}
            onClick={() => toggle(c.id)}
            title={c.label}
          >
            <span className="icon" aria-hidden>
              <Icon size={15} strokeWidth={2.2} />
            </span>
            {c.label}
            <span className="hand text-ink-soft">{counts[c.id].toLocaleString("de-DE")}</span>
          </button>
        );
      })}
    </div>
  );
}

export function MoodChips({ mood, setMood, className = "" }: { mood: string | null; setMood: (m: string | null) => void; className?: string }) {
  return (
    <div className={`flex gap-1.5 ${className}`}>
      {MOODS.map((m) => (
        <button key={m.id} className="pill" aria-pressed={mood === m.id} onClick={() => setMood(mood === m.id ? null : m.id)}>
          {m.emoji} {m.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Lists ----------

export function ListChips({
  lists,
  activeListId,
  setActive,
  onNew,
  className = "",
}: {
  lists: UserList[];
  activeListId: string | null;
  setActive: (id: string | null) => void;
  onNew: () => void;
  className?: string;
}) {
  return (
    <div className={`flex gap-1.5 ${className}`}>
      {lists.map((l) => (
        <button key={l.id} className="pill" aria-pressed={activeListId === l.id} onClick={() => setActive(activeListId === l.id ? null : l.id)}>
          {l.emoji} {l.name} <span className="text-xs tabular-nums opacity-70">{l.ids.length}</span>
        </button>
      ))}
      <button className="pill border-dashed" onClick={onNew}>
        <Plus size={14} /> New
      </button>
    </div>
  );
}

// ---------- Place rows (sidebar lists) ----------

export function PlaceRow({ p, selected, onClick, tag }: { p: PlaceWithDistance; selected: boolean; onClick: () => void; tag?: string }) {
  const c = CATEGORY_BY_ID[p.cat];
  return (
    <li>
      <button
        onClick={onClick}
        className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors ${selected ? "bg-honey-soft" : "hover:bg-parchment-deep/70"}`}
        aria-current={selected || undefined}
      >
        <CatSticker id={p.cat} color={c.color} size={32} tag={tag} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold leading-tight">{p.name}</span>
          <span className="block truncate text-xs text-ink-soft">
            {p.kind}
            {p.fee === "no" && " · Free"}
          </span>
        </span>
        {p.distanceKm != null && <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-soft">{formatDistance(p.distanceKm)}</span>}
      </button>
    </li>
  );
}

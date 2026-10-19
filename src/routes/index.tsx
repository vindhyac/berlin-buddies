import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Dices, Link2, RefreshCw, Trash2 } from "lucide-react";
import { AdventureSpinner } from "../components/AdventureSpinner";
import { AreaPicker, CategoryCards, CategoryChips, ListChips, MoodChips, PlaceRow, SearchBox } from "../components/Controls";
import { EVENT_EMOJI, EventCard, EventRow, OngoingSection, ViewTabs, WhenChips, type View } from "../components/Events";
import type { MapItem } from "../components/MapView";
import { FeaturedSpot } from "../components/FeaturedSpot";
import { NewListDialog } from "../components/NewListDialog";
import { PlaceCard } from "../components/PlaceCard";
import { KIEZE, distanceKm, filterByArea, insideBerlinBox, type Area, type LatLon } from "../lib/area";
import { CATEGORIES, CATEGORY_BY_ID, MOODS } from "../lib/categories";
import { WHENS, berlinToday, inWindow, isSingleDay, matchesWhen, nextDay, whenLabel, type When } from "../lib/events";
import { DEFAULT_LISTS, FAVORITES_ID, VISITED_ID, decodeList, loadLists, newListId, saveLists, shareUrl } from "../lib/lists";
import { topPicks } from "../lib/score";
import type { CategoryId, EventsResponse, Place, PlacesResponse, UserList } from "../lib/types";
import { getBerlinFamilyPlaces, getKidEvents } from "../server/functions";

const MapView = lazy(() => import("../components/MapView"));

/**
 * Data saved every few hours by the GitHub Action (public/data/). Falls back to the live
 * server function when there's no snapshot yet, e.g. in local dev.
 */
async function snapshotOr<T>(path: string, live: () => Promise<T>): Promise<T> {
  try {
    const res = await fetch(path, { cache: "no-cache" });
    if (res.ok && res.headers.get("content-type")?.includes("json")) return (await res.json()) as T;
  } catch {
    // no snapshot: use the live fetch
  }
  return live();
}

export const Route = createFileRoute("/")({ component: BerlinBuddies });

const ALL_CATS = new Set<CategoryId>(CATEGORIES.map((c) => c.id));
const PAGE = 60;

function BerlinBuddies() {
  // ---- data ----
  const [data, setData] = useState<PlacesResponse | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let live = true;
    setLoadFailed(false);
    snapshotOr<PlacesResponse>("/data/places.json", () => getBerlinFamilyPlaces())
      .then((d) => live && setData(d))
      .catch(() => live && setLoadFailed(true));
    return () => {
      live = false;
    };
  }, [reloadKey]);

  // Events load on their own, so places never wait for visitBerlin.
  const [eventsData, setEventsData] = useState<EventsResponse | null>(null);
  const [eventsKey, setEventsKey] = useState(0);
  useEffect(() => {
    let live = true;
    setEventsData(null);
    snapshotOr<EventsResponse>("/data/events.json", () => getKidEvents())
      // a snapshot can be hours old: drop events that have ended since
      .then((d) => live && setEventsData({ ...d, events: d.events.filter((e) => inWindow(e, berlinToday())) }))
      .catch(() => live && setEventsData({ events: [], source: "unavailable", fetchedAt: new Date().toISOString() }));
    return () => {
      live = false;
    };
  }, [eventsKey]);

  // ---- filters & selection ----
  const [view, setViewState] = useState<View>("places");
  const [when, setWhen] = useState<When>("week");
  const [cats, setCats] = useState<Set<CategoryId>>(ALL_CATS);
  const [mood, setMood] = useState<string | null>(null);
  const [area, setAreaState] = useState<Area>({ kind: "all" });
  const [me, setMe] = useState<LatLon | null>(null);
  const [locating, setLocating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCount, setShowCount] = useState(PAGE);

  // ---- lists ----
  const [lists, setLists] = useState<UserList[]>(DEFAULT_LISTS);
  const [listsReady, setListsReady] = useState(false);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [sharedName, setSharedName] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ---- overlays ----
  const [spinnerOpen, setSpinnerOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newListFor, setNewListFor] = useState<{ placeId?: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  // Load lists from this browser, and open a shared ?list= link as a copy.
  useEffect(() => {
    let loaded = loadLists();
    const param = new URLSearchParams(location.search).get("list");
    if (param) {
      const shared = decodeList(param);
      if (shared) {
        const same = loaded.find(
          (l) => !l.builtin && l.name === shared.name && l.ids.length === shared.ids.length && l.ids.every((id) => shared.ids.includes(id)),
        );
        const list = same ?? { id: newListId(), ...shared };
        if (!same) loaded = [...loaded, list];
        setActiveListId(list.id);
        setSharedName(list.name);
      } else {
        setToast("That shared link looks broken, so we're showing all of Berlin.");
      }
    }
    setLists(loaded);
    setListsReady(true);
  }, []);
  useEffect(() => {
    if (listsReady) saveLists(lists);
  }, [lists, listsReady]);

  const setArea = (a: Area) => {
    setAreaState(a);
    setShowCount(PAGE);
  };

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setToast("This browser can't share your location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setMe(here);
        setLocating(false);
        if (!insideBerlinBox(here)) setToast("You seem to be outside Berlin, so distances will be long.");
      },
      (err) => {
        setLocating(false);
        setAreaState((a) => (a.kind === "near" ? { kind: "all" } : a));
        setToast(
          err.code === 1
            ? "Location is blocked. Allow it in your browser settings to see places near you."
            : "We couldn't find your location. Try again in a moment.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }, []);

  const toggleCat = (id: CategoryId) =>
    setCats((prev) => {
      // First tap on a full set focuses that one category; otherwise toggle it.
      if (prev.size === ALL_CATS.size) return new Set([id]);
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next.size === 0 ? new Set(ALL_CATS) : next;
    });

  const toggleInList = (listId: string, placeId: string) =>
    setLists((ls) =>
      ls.map((l) =>
        l.id !== listId ? l : { ...l, ids: l.ids.includes(placeId) ? l.ids.filter((x) => x !== placeId) : [...l.ids, placeId] },
      ),
    );

  const createList = (name: string, emoji: string) => {
    const list: UserList = { id: newListId(), name, emoji, ids: newListFor?.placeId ? [newListFor.placeId] : [] };
    setLists((ls) => [...ls, list]);
    setToast(`${emoji} ${name} is ready.`);
    setNewListFor(null);
  };

  const selectList = (id: string | null) => {
    setActiveListId(id);
    setConfirmDelete(false);
    setShowCount(PAGE);
    if (!id && location.search.includes("list=")) {
      history.replaceState(null, "", location.pathname);
      setSharedName(null);
    }
  };

  const deleteList = (id: string) => {
    setLists((ls) => ls.filter((l) => l.id !== id));
    selectList(null);
    setToast("List deleted.");
  };

  const shareList = async (l: UserList) => {
    const url = shareUrl(l);
    try {
      await navigator.clipboard.writeText(url);
      setToast(`Link copied. Anyone who opens it sees “${l.name}”.`);
    } catch {
      setToast(url);
    }
  };

  // ---- derived ----
  const all = data?.places ?? [];
  const byId = useMemo(() => new Map(all.map((p) => [p.id, p])), [all]);
  const activeList = lists.find((l) => l.id === activeListId) ?? null;
  const areaPlaces = useMemo(() => filterByArea(all, area, me), [all, area, me]);

  const beforeCats = useMemo(() => {
    let s = areaPlaces;
    if (activeList) {
      const ids = new Set(activeList.ids);
      s = s.filter((p) => ids.has(p.id));
    }
    const m = MOODS.find((x) => x.id === mood);
    if (m) s = s.filter(m.test);
    return s;
  }, [areaPlaces, activeList, mood]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(CATEGORIES.map((x) => [x.id, 0])) as Record<CategoryId, number>;
    for (const p of beforeCats) c[p.cat]++;
    return c;
  }, [beforeCats]);

  const visible = useMemo(() => beforeCats.filter((p) => cats.has(p.cat)), [beforeCats, cats]);
  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  // ---- events ----
  const today = berlinToday();
  const allEvents = eventsData?.events ?? [];
  const eventsById = useMemo(() => new Map(allEvents.map((e) => [e.id, e])), [allEvents]);
  const areaEvents = useMemo(() => filterByArea(allEvents, area, me), [allEvents, area, me]);
  const datedEvents = useMemo(() => areaEvents.filter((e) => !e.ongoing), [areaEvents]);
  const whenCounts = useMemo(
    () => Object.fromEntries(WHENS.map((w) => [w.id, datedEvents.filter((e) => matchesWhen(e, w.id, today)).length])) as Record<When, number>,
    [datedEvents, today],
  );
  const shownEvents = useMemo(
    () =>
      datedEvents
        .filter((e) => matchesWhen(e, when, today))
        .sort((a, b) => nextDay(a, today).localeCompare(nextDay(b, today)) || a.start.slice(11).localeCompare(b.start.slice(11))),
    [datedEvents, when, today],
  );
  // Single-day events by date first; short runs (exact days unknown) after them.
  const oneOffs = useMemo(() => shownEvents.filter(isSingleDay), [shownEvents]);
  const runs = useMemo(() => shownEvents.filter((e) => !isSingleDay(e)), [shownEvents]);
  const ongoingEvents = useMemo(() => areaEvents.filter((e) => e.ongoing), [areaEvents]);
  const selectedEvent = selectedId ? eventsById.get(selectedId) ?? null : null;
  const savedIds = useMemo(() => new Set(lists.find((l) => l.id === FAVORITES_ID)?.ids ?? []), [lists]);

  // What the map shows: places, or this filter's events (ongoing ones only when picked).
  const mapItems = useMemo<MapItem[]>(() => {
    if (view === "events") {
      const evs = selectedEvent && !shownEvents.some((e) => e.id === selectedEvent.id) ? [...shownEvents, selectedEvent] : shownEvents;
      return evs.map((e) => ({ id: e.id, name: e.name, lat: e.lat, lon: e.lon, emoji: EVENT_EMOJI, kind: whenLabel(e, today) }));
    }
    const ps = selected && !visible.some((p) => p.id === selected.id) ? [...visible, selected] : visible;
    return ps.map((p) => ({ id: p.id, name: p.name, lat: p.lat, lon: p.lon, emoji: CATEGORY_BY_ID[p.cat].emoji, kind: p.kind }));
  }, [view, shownEvents, selectedEvent, visible, selected, today]);

  // Pins show the emoji of a list they belong to: own lists first, then ❤️, then ✅.
  const pinTags = useMemo(() => {
    const m = new Map<string, string>();
    const order = [...lists.filter((l) => !l.builtin), ...lists.filter((l) => l.id === FAVORITES_ID), ...lists.filter((l) => l.id === VISITED_ID)];
    for (const l of order) for (const id of l.ids) if (!m.has(id)) m.set(id, l.emoji);
    return m;
  }, [lists]);

  const picks = useMemo(() => topPicks(visible), [visible]);

  const spinCandidates = useMemo(() => {
    let base: Place[] = visible;
    if (me && area.kind === "all") base = base.filter((p) => distanceKm(me, p) <= 5);
    const top = topPicks(base, 25);
    if (top.length >= 3) return top;
    return base.length ? base.slice(0, 40) : topPicks(visible, 25);
  }, [visible, me, area.kind]);

  const circle =
    area.kind === "near" && me
      ? { center: me, radiusKm: area.radiusKm }
      : area.kind === "kiez"
        ? (() => {
            const k = KIEZE.find((k) => k.id === area.kiezId)!;
            return { center: { lat: k.lat, lon: k.lon }, radiusKm: k.radiusKm };
          })()
        : null;

  const kiezName = area.kind === "kiez" ? KIEZE.find((k) => k.id === area.kiezId)?.name : null;
  const listMode = activeList != null;
  const nearMode = area.kind !== "all" && !!circle;
  const rows = listMode || nearMode ? visible : picks;
  const rowsTitle = listMode
    ? `${activeList!.emoji} ${activeList!.name}`
    : nearMode
      ? area.kind === "near"
        ? `Closest to you`
        : `In ${kiezName}`
      : "Top family picks";

  const setView = (v: View) => {
    setViewState(v);
    setSelectedId(null);
    setShowCount(PAGE);
  };

  const select = (p: Place | null) => {
    if (p && view !== "places") setViewState("places");
    setSelectedId(p ? p.id : null);
    // On phones, drop the drawer so the picked place is visible on the map.
    if (p) setDrawerOpen(false);
  };

  const selectEvent = (id: string) => {
    setSelectedId(id);
    setDrawerOpen(false);
  };

  // ---- render pieces ----
  const status = !data ? (
    loadFailed ? (
      <span className="flex items-center gap-2">
        Couldn't reach the map data.{" "}
        <button className="underline" onClick={() => setReloadKey((k) => k + 1)}>
          Try again
        </button>
      </span>
    ) : (
      <span className="flex items-center gap-2">
        <span className="dice-roll" aria-hidden>
          🧭
        </span>{" "}
        Gathering Berlin's best spots from OpenStreetMap…
      </span>
    )
  ) : data.source === "fallback" ? (
    <span className="flex flex-wrap items-center gap-x-2">
      The live map data is busy, so here are 14 favourite spots.
      <button className="inline-flex items-center gap-1 font-semibold underline" onClick={() => setReloadKey((k) => k + 1)}>
        <RefreshCw size={13} /> Try again
      </button>
    </span>
  ) : (
    <span>
      <strong className="tabular-nums">{all.length.toLocaleString("de-DE")}</strong> places to explore · {visible.length.toLocaleString("de-DE")} on the map
    </span>
  );

  const listActions = activeList && (
    <div className="flex flex-wrap items-center gap-2">
      <button className="btn !px-3 !py-1.5 text-sm" onClick={() => shareList(activeList)} disabled={!activeList.ids.length}>
        <Link2 size={15} /> Share list
      </button>
      {!activeList.builtin &&
        (confirmDelete ? (
          <>
            <button className="btn !border-stamp !px-3 !py-1.5 text-sm !text-stamp" onClick={() => deleteList(activeList.id)}>
              Delete “{activeList.name}”
            </button>
            <button className="text-sm underline" onClick={() => setConfirmDelete(false)}>
              Keep it
            </button>
          </>
        ) : (
          <button className="btn !px-3 !py-1.5 text-sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={15} /> Delete
          </button>
        ))}
    </div>
  );

  const featured = !listMode && !nearMode ? picks[0] : undefined;

  // Phone drawer: tap the handle to toggle, or drag it up / down.
  const dragFrom = useRef<number | null>(null);
  const onHandleDown = (e: React.PointerEvent) => {
    dragFrom.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHandleUp = (e: React.PointerEvent) => {
    if (dragFrom.current == null) return;
    const dy = e.clientY - dragFrom.current;
    dragFrom.current = null;
    setDrawerOpen((open) => (dy < -30 ? true : dy > 30 ? false : !open));
  };

  return (
    <div className="desk flex h-dvh w-full flex-col overflow-hidden lg:flex-row">
      {/* ---------------- Notebook sheet: sidebar on desktop, pull-up drawer on phones ---------------- */}
      <aside
        className={`notebook fixed inset-x-0 bottom-0 z-[1000] flex h-[86dvh] flex-col rounded-t-2xl shadow-[0_-6px_20px_rgba(45,52,54,0.18)] transition-transform duration-300 lg:relative lg:z-20 lg:my-4 lg:ml-4 lg:h-auto lg:w-[340px] lg:shrink-0 lg:translate-y-0 lg:rounded-sm lg:shadow-[2px_6px_16px_rgba(45,52,54,0.14)] ${
          drawerOpen ? "translate-y-0" : "translate-y-[calc(100%-var(--peek))]"
        }`}
        aria-label="Berlin Buddies field guide"
      >
        <span className="washi -top-2 left-1/2 hidden -translate-x-1/2 -rotate-2 lg:block" aria-hidden />
        <span className="washi -bottom-1.5 right-6 hidden rotate-3 lg:block" aria-hidden />

        <button
          className="drawer-handle flex shrink-0 justify-center pb-1 pt-2.5 lg:hidden"
          onPointerDown={onHandleDown}
          onPointerUp={onHandleUp}
          aria-label={drawerOpen ? "Show the map" : "Show filters and places"}
          aria-expanded={drawerOpen}
        >
          <span />
        </button>

        <header className="relative shrink-0 px-4 lg:px-5 lg:pb-1 lg:pt-6">
          <div className="rubber-stamp absolute right-4 top-3 hidden lg:grid" aria-hidden>
            Field Guide · Berlin
          </div>
          <div className="flex items-center gap-3 lg:block">
            <h1 className="wordmark shrink-0 !text-[1.3rem] lg:!text-[28px]">
              Berlin <em>Buddies</em>
            </h1>
            <p className="mt-1.5 hidden text-[15px] text-ink lg:block">
              <span className="scribble">The Berlin guide for busy families.</span>
            </p>
            <div className="min-w-0 flex-1 lg:mt-4">
              <SearchBox places={all} onPick={select} idSuffix="sheet" onFocus={() => setDrawerOpen(true)} />
            </div>
          </div>
          <div className="mt-3">
            <ViewTabs view={view} setView={setView} eventCount={eventsData ? allEvents.filter((e) => !e.ongoing).length : null} />
          </div>
          {view === "places" ? (
            <CategoryChips active={cats} toggle={toggleCat} counts={counts} className="scroll-x -mx-4 mt-2.5 px-4 pb-1 lg:hidden" />
          ) : (
            <div className="scroll-x -mx-4 mt-2.5 px-4 pb-1 lg:hidden">
              <WhenChips when={when} setWhen={setWhen} counts={whenCounts} className="w-max" />
            </div>
          )}
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-6 pt-4 lg:px-5 lg:py-5">
          {view === "events" ? (
            <>
              <section className="flex flex-col gap-2">
                <h2 className="eyebrow">Where</h2>
                <AreaPicker area={area} setArea={setArea} hasLocation={!!me} locating={locating} onLocate={locate} idSuffix="events" />
              </section>
              <section className="hidden flex-col gap-2 lg:flex">
                <h2 className="eyebrow">When</h2>
                <WhenChips when={when} setWhen={setWhen} counts={whenCounts} />
              </section>
              <section className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold text-ink">{WHENS.find((w) => w.id === when)!.label}</h2>
                  <span className="hand text-base tabular-nums text-ink-soft">{oneOffs.length}</span>
                </div>
                {!eventsData && (
                  <p className="flex items-center gap-2 text-sm text-ink-soft">
                    <span className="dice-roll" aria-hidden>
                      {EVENT_EMOJI}
                    </span>
                    Collecting this week's kids' events from visitBerlin…
                  </p>
                )}
                {eventsData?.source === "unavailable" && (
                  <p className="text-sm text-ink-soft">
                    visitBerlin's calendar isn't reachable right now.{" "}
                    <button className="font-semibold underline" onClick={() => setEventsKey((k) => k + 1)}>
                      Try again
                    </button>
                  </p>
                )}
                {eventsData && eventsData.source !== "unavailable" && oneOffs.length === 0 && (
                  <p className="text-sm text-ink-soft">No one-off events here. Try another day, a bigger area, or the longer runs below.</p>
                )}
                <ul className="flex flex-col gap-2.5">
                  {oneOffs.slice(0, showCount).map((e) => (
                    <EventRow key={e.id} e={e} today={today} selected={e.id === selectedId} saved={savedIds.has(e.id)} onClick={() => selectEvent(e.id)} />
                  ))}
                </ul>
                {oneOffs.length > showCount && (
                  <button className="btn mt-1" onClick={() => setShowCount((n) => n + PAGE)}>
                    Show {Math.min(PAGE, oneOffs.length - showCount)} more
                  </button>
                )}
              </section>
              {runs.length > 0 && (
                <section className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="text-lg font-semibold text-ink">
                      Running on several days
                      <span className="block text-xs font-normal text-ink-soft">Check visitBerlin for the exact dates</span>
                    </h2>
                    <span className="hand text-base tabular-nums text-ink-soft">{runs.length}</span>
                  </div>
                  <ul className="flex flex-col gap-2.5">
                    {runs.map((e) => (
                      <EventRow key={e.id} e={e} today={today} selected={e.id === selectedId} saved={savedIds.has(e.id)} onClick={() => selectEvent(e.id)} />
                    ))}
                  </ul>
                </section>
              )}
              <OngoingSection count={ongoingEvents.length}>
                {ongoingEvents.map((e) => (
                  <EventRow key={e.id} e={e} today={today} selected={e.id === selectedId} saved={savedIds.has(e.id)} onClick={() => selectEvent(e.id)} />
                ))}
              </OngoingSection>
              <footer className="mt-auto text-xs text-ink-soft">
                Kids' events from{" "}
                <a className="underline" href="https://www.visitberlin.de/en/events-children-Berlin" target="_blank" rel="noopener">
                  visitBerlin
                </a>
                , refreshed every few hours. Always check times before you go.
              </footer>
            </>
          ) : (
            <>
          <section className="hidden flex-col gap-2.5 lg:flex">
            <h2 className="eyebrow">Discover</h2>
            <CategoryCards active={cats} toggle={toggleCat} counts={counts} />
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="eyebrow">Where</h2>
            <AreaPicker area={area} setArea={setArea} hasLocation={!!me} locating={locating} onLocate={locate} idSuffix="sheet" />
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="eyebrow">Quick filters</h2>
            <MoodChips mood={mood} setMood={setMood} className="flex-wrap" />
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="eyebrow">My lists</h2>
            <ListChips lists={lists} activeListId={activeListId} setActive={selectList} onNew={() => setNewListFor({})} className="flex-wrap" />
            {listActions}
          </section>

          {featured && (
            <section className="flex flex-col gap-3">
              <div className="pt-2">
                <FeaturedSpot place={featured} onOpen={() => select(featured)} />
              </div>
            </section>
          )}

          <section className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-ink">{rowsTitle}</h2>
              <span className="hand text-base tabular-nums text-ink-soft">{rows.length.toLocaleString("de-DE")}</span>
            </div>
            {area.kind === "near" && !me && <p className="text-sm text-ink-soft">Share your location to see what's close by.</p>}
            {rows.length === 0 && data && (
              <p className="text-sm text-ink-soft">
                {listMode ? "Nothing here yet. Open a place and tap a list button to add it." : "Nothing matches. Try another badge or filter."}
              </p>
            )}
            <ul className="-mx-2 flex flex-col">
              {rows.slice(0, showCount).map((p) => (
                <PlaceRow key={p.id} p={p} selected={p.id === selectedId} onClick={() => select(p)} tag={pinTags.get(p.id)} />
              ))}
            </ul>
            {rows.length > showCount && (
              <button className="btn mt-2" onClick={() => setShowCount((n) => n + PAGE)}>
                Show {Math.min(PAGE, rows.length - showCount)} more
              </button>
            )}
          </section>

          <footer className="mt-auto text-xs text-ink-soft">
            {status}
            <p className="mt-2">
              Map data © OpenStreetMap contributors. Photos and notes from Wikipedia and Wikimedia Commons. Lists stay in this browser.
            </p>
          </footer>
            </>
          )}
        </div>
      </aside>

      {/* ---------------- Map: a folded paper map on the desk ---------------- */}
      <main className="relative min-h-0 flex-1 p-2 lg:isolate lg:p-4 lg:pl-6">
        <ClientOnly fallback={<MapPlaceholder />}>
          <Suspense fallback={<MapPlaceholder />}>
            <MapView items={mapItems} selectedId={selectedId} onSelect={setSelectedId} tags={pinTags} me={me} circle={circle} />
          </Suspense>
        </ClientOnly>

        {/* status / shared banner */}
        <div className="pointer-events-none absolute left-1/2 top-5 z-[900] flex w-[min(92%,34rem)] -translate-x-1/2 flex-col items-center gap-2">
          {sharedName && activeListId && (
            <div className="toast pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
              <span>
                Showing a shared list: <strong>{sharedName}</strong>
              </span>
              <button className="font-semibold text-honey underline" onClick={() => selectList(null)}>
                Show everything
              </button>
            </div>
          )}
          {(!data || data.source === "fallback") && (
            <div className="pointer-events-auto rounded-xl border-2 border-ink bg-paper px-4 py-2 text-sm shadow-lg lg:hidden">{status}</div>
          )}
          {!data && <div className="pointer-events-auto hidden rounded-xl border-2 border-ink bg-paper px-4 py-2 text-sm shadow-lg lg:block">{status}</div>}
        </div>

        {/* place card */}
        {selected && (
          <div className="absolute inset-x-2 bottom-4 z-[1100] flex max-h-[62%] lg:inset-x-auto lg:bottom-auto lg:right-6 lg:top-6 lg:max-h-[calc(100%-3rem)] lg:w-[380px]">
            <PlaceCard
              place={selected}
              lists={lists}
              me={me}
              locating={locating}
              onLocate={locate}
              onToggle={toggleInList}
              onNewList={(placeId) => setNewListFor({ placeId })}
              onClose={() => setSelectedId(null)}
            />
          </div>
        )}

        {selectedEvent && (
          <div className="absolute inset-x-2 bottom-4 z-[1100] flex max-h-[62%] lg:inset-x-auto lg:bottom-auto lg:right-6 lg:top-6 lg:max-h-[calc(100%-3rem)] lg:w-[380px]">
            <EventCard
              event={selectedEvent}
              today={today}
              lists={lists}
              me={me}
              locating={locating}
              onLocate={locate}
              onToggle={toggleInList}
              onClose={() => setSelectedId(null)}
            />
          </div>
        )}

        {/* spinner tag */}
        <div className={`spin-fab-wrap absolute bottom-[calc(var(--peek)+0.9rem)] left-4 z-[900] lg:bottom-7 lg:left-7 ${selected || selectedEvent ? "hidden lg:block" : ""} ${view === "events" ? "!hidden" : ""}`}>
          <button className="spin-fab" onClick={() => setSpinnerOpen(true)} disabled={!all.length}>
            <span className="die" aria-hidden>
              <Dices size={22} strokeWidth={2} />
            </span>
            <span>
              Spin for
              <br />
              Adventure!
            </span>
          </button>
        </div>

        {toast && (
          <div
            role="status"
            className="toast absolute bottom-[calc(var(--peek)+4.5rem)] left-1/2 z-[1500] w-[min(92%,30rem)] -translate-x-1/2 break-words px-4 py-3 text-sm lg:bottom-24"
          >
            {toast}
          </div>
        )}
      </main>

      {spinnerOpen && (
        <AdventureSpinner
          candidates={spinCandidates}
          me={me}
          onClose={() => setSpinnerOpen(false)}
          onAccept={(p) => {
            setSelectedId(p.id);
            setSpinnerOpen(false);
          }}
        />
      )}
      {newListFor && (
        <NewListDialog
          forPlaceName={newListFor.placeId ? byId.get(newListFor.placeId)?.name : undefined}
          onCreate={createList}
          onClose={() => setNewListFor(null)}
        />
      )}
    </div>
  );
}

function MapPlaceholder() {
  return (
    <div className="map-sheet grid place-items-center text-ink-soft">
      <span className="hand text-xl">Unfolding the map…</span>
    </div>
  );
}

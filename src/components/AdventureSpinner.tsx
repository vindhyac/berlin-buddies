import { useEffect, useRef, useState } from "react";
import { Navigation, RotateCcw, X } from "lucide-react";
import { distanceKm, formatDistance, type LatLon } from "../lib/area";
import { CATEGORY_BY_ID } from "../lib/categories";
import { CatSticker } from "../lib/icons";
import { directionsUrl } from "../lib/links";
import type { Place } from "../lib/types";

interface Props {
  candidates: Place[];
  me: LatLon | null;
  onAccept: (p: Place) => void;
  onClose: () => void;
}

const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function AdventureSpinner({ candidates, me, onAccept, onClose }: Props) {
  const [shown, setShown] = useState<Place | null>(null);
  const [spinning, setSpinning] = useState(false);
  const timers = useRef<number[]>([]);
  const lastPick = useRef<string | null>(null);

  const spin = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (!candidates.length) return;
    let pool = candidates.filter((c) => c.id !== lastPick.current);
    if (!pool.length) pool = candidates;
    const target = pool[Math.floor(Math.random() * pool.length)];
    lastPick.current = target.id;

    if (reduceMotion()) {
      setShown(target);
      return;
    }
    setSpinning(true);
    // Ease out: ticks get further apart, like a wheel slowing down.
    const ticks = 18;
    let t = 0;
    for (let i = 0; i < ticks; i++) {
      t += 35 + i * i * 1.1;
      const last = i === ticks - 1;
      timers.current.push(
        window.setTimeout(() => {
          setShown(last ? target : candidates[Math.floor(Math.random() * candidates.length)]);
          if (last) setSpinning(false);
        }, t),
      );
    }
  };

  useEffect(() => {
    spin();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      timers.current.forEach(clearTimeout);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cat = shown ? CATEGORY_BY_ID[shown.cat] : null;
  const dist = shown && me ? distanceKm(me, shown) : null;

  return (
    <div className="scrim fixed inset-0 z-[2000] grid place-items-center p-4" onClick={onClose}>
      <div
        className="mission relative w-full max-w-md p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mission-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-ink-soft hover:bg-parchment" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <p className="eyebrow">{spinning ? "Spinning…" : "Today's Mission"}</p>
        <h2 id="mission-title" className="mt-1 text-[1.65rem] font-semibold leading-tight text-ink">
          {spinning ? (
            <>
              <span className="dice-roll" aria-hidden>
                🎲
              </span>{" "}
              Where to, explorers?
            </>
          ) : candidates.length ? (
            "Your adventure awaits!"
          ) : (
            "No adventures in sight"
          )}
        </h2>

        {candidates.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">Switch on a few more categories or widen the area, then spin again.</p>
        ) : (
          <div className="reel mt-4 flex min-h-[7.5rem] items-center gap-4 p-4" aria-live="polite">
            {shown && cat && (
              <>
                <CatSticker id={cat.id} color={cat.color} size={64} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-widest text-honey">{cat.badge}</p>
                  <p className="reel-name text-xl leading-tight">{shown.name}</p>
                  <p className="text-sm opacity-80">
                    {shown.kind}
                    {dist != null && ` · ${formatDistance(dist)}`}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {shown && !spinning && (
            <a
              className="btn btn-primary flex-1"
              href={directionsUrl(shown, me)}
              target="_blank"
              rel="noopener"
              onClick={() => onAccept(shown)}
            >
              <Navigation size={16} /> Accept & get directions
            </a>
          )}
          <button className="btn btn-honey flex-1" onClick={spin} disabled={spinning || !candidates.length}>
            <RotateCcw size={16} /> Spin again
          </button>
        </div>
        <p className="mt-3 text-xs text-ink-soft">
          Picked from {candidates.length} top family spots {me ? "near you" : "in your current view"}.
        </p>
      </div>
    </div>
  );
}

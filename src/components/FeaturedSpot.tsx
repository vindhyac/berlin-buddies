import { useEffect, useState } from "react";
import { CATEGORY_BY_ID } from "../lib/categories";
import type { Place, PlaceDetails } from "../lib/types";
import { fetchDetails } from "./PlaceCard";

/** The top family pick: a kraft-paper card with a Polaroid paper-clipped to it. */
export function FeaturedSpot({ place, onOpen }: { place: Place; onOpen: () => void }) {
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const cat = CATEGORY_BY_ID[place.cat];

  useEffect(() => {
    let live = true;
    setDetails(null);
    fetchDetails(place).then((d) => live && setDetails(d));
    return () => {
      live = false;
    };
  }, [place.id]);

  return (
    <button className="kraft" onClick={onOpen} aria-label={`Featured spot: ${place.name}`}>
      <svg className="paperclip" viewBox="0 0 18 46" fill="none" aria-hidden>
        <path
          d="M6 14 V35 a3 3 0 0 0 6 0 V8 a5 5 0 0 0 -10 0 V36 a7 7 0 0 0 14 0 V14"
          stroke="#5f5a50"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      <span className="polaroid" aria-hidden>
        <span className="block aspect-square w-full overflow-hidden bg-parchment-deep">
          {details?.photo ? (
            <img src={details.photo.url} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <span
              className="grid h-full w-full place-items-center"
              style={{ background: `color-mix(in oklab, ${cat.color} 22%, var(--parchment))` }}
            >
              <span className={`text-3xl ${details ? "" : "animate-pulse"}`}>{cat.emoji}</span>
            </span>
          )}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="hand block text-lg leading-tight text-[#7a4a2a]">Featured Spot</span>
        <span className="mt-0.5 block font-display text-[1.05rem] font-semibold leading-tight text-ink">{place.name}</span>
        <span className="mt-1 block truncate text-xs font-semibold text-[#5f5a50]">
          {place.kind}
          {place.fee === "no" && " · Free"}
        </span>
      </span>
    </button>
  );
}

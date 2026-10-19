import { useEffect, useState } from "react";
import { Accessibility, Clock, ExternalLink, Heart, LocateFixed, MapPin, Navigation, Plus, Star, Ticket, X, BookOpen, Baby } from "lucide-react";
import { formatDistance, distanceKm, type LatLon } from "../lib/area";
import { CATEGORY_BY_ID } from "../lib/categories";
import { ageLabel, directionsUrl } from "../lib/links";
import { FAVORITES_ID, VISITED_ID } from "../lib/lists";
import type { Place, PlaceDetails, UserList } from "../lib/types";
import { getPlaceDetails } from "../server/functions";

const detailsCache = new Map<string, Promise<PlaceDetails>>();
export function fetchDetails(p: Place): Promise<PlaceDetails> {
  let hit = detailsCache.get(p.id);
  if (!hit) {
    hit = getPlaceDetails({
      data: { id: p.id, name: p.name, cat: p.cat, lat: p.lat, lon: p.lon, wikidata: p.wikidata, wikipedia: p.wikipedia },
    }).catch(() => ({}) as PlaceDetails);
    detailsCache.set(p.id, hit);
  }
  return hit;
}

interface Props {
  place: Place;
  lists: UserList[];
  me: LatLon | null;
  locating: boolean;
  onLocate: () => void;
  onToggle: (listId: string, placeId: string) => void;
  onNewList: (placeId: string) => void;
  onClose: () => void;
}

export function PlaceCard({ place, lists, me, locating, onLocate, onToggle, onNewList, onClose }: Props) {
  const [details, setDetails] = useState<PlaceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [justStamped, setJustStamped] = useState(false);
  const cat = CATEGORY_BY_ID[place.cat];

  useEffect(() => {
    let live = true;
    setDetails(null);
    setLoading(true);
    setJustStamped(false);
    fetchDetails(place).then((d) => {
      if (live) {
        setDetails(d);
        setLoading(false);
      }
    });
    return () => {
      live = false;
    };
  }, [place.id]);

  const inList = (id: string) => lists.find((l) => l.id === id)?.ids.includes(place.id) ?? false;
  const fav = inList(FAVORITES_ID);
  const visited = inList(VISITED_ID);
  const custom = lists.filter((l) => !l.builtin);
  const dist = me ? distanceKm(me, place) : null;
  const ages = ageLabel(place);

  const toggleVisited = () => {
    if (!visited) setJustStamped(true);
    onToggle(VISITED_ID, place.id);
  };

  return (
    <article className="place-card relative flex max-h-full flex-col overflow-hidden" aria-label={place.name}>
      <button
        onClick={onClose}
        className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border-2 border-ink bg-paper text-ink"
        aria-label="Close place card"
      >
        <X size={18} />
      </button>

      <div className="photo-frame relative aspect-[5/2] lg:aspect-[16/9] w-full shrink-0 overflow-hidden">
        {details?.photo ? (
          <img src={details.photo.url} alt={place.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-full w-full place-items-center" style={{ background: `color-mix(in oklab, ${cat.color} 22%, var(--parchment))` }}>
            <span className={`text-6xl ${loading ? "animate-pulse" : ""}`} aria-hidden>
              {cat.emoji}
            </span>
          </div>
        )}
        <span
          className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white"
          style={{ background: cat.color, boxShadow: "0 0 0 2px #fff" }}
        >
          {cat.emoji} {cat.badge}
        </span>
        {visited && (
          <div className="absolute right-4 bottom-4">
            <div className={`stamp ${justStamped ? "is-new" : ""}`}>STAMPED</div>
            {justStamped && (
              <div className="burst" aria-hidden>
                {Array.from({ length: 10 }, (_, i) => (
                  <i key={i} style={{ ["--r" as any]: `${i * 36}deg` }} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4">
        <div>
          <p className="eyebrow">{place.kind}</p>
          <h2 className="text-2xl font-semibold leading-tight text-ink">{place.name}</h2>
          {(place.address || dist != null) && (
            <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-soft">
              <MapPin size={15} className="mt-0.5 shrink-0" />
              <span>
                {place.address}
                {place.address && dist != null && " · "}
                {dist != null && <strong className="text-ink">{formatDistance(dist)} away</strong>}
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {place.fee === "no" && (
            <span className="fact fact-good">
              <Ticket size={13} /> Free
            </span>
          )}
          {place.fee === "yes" && (
            <span className="fact">
              <Ticket size={13} /> Entry fee
            </span>
          )}
          {place.wheelchair === "yes" && (
            <span className="fact fact-good">
              <Accessibility size={13} /> Step-free
            </span>
          )}
          {place.wheelchair === "limited" && (
            <span className="fact">
              <Accessibility size={13} /> Partly step-free
            </span>
          )}
          {ages && (
            <span className="fact">
              <Baby size={13} /> {ages}
            </span>
          )}
          {place.hours && (
            <span className="fact max-w-full">
              <Clock size={13} className="shrink-0" /> <span className="truncate">{place.hours}</span>
            </span>
          )}
          {details?.google && (
            <span className="fact">
              <Star size={13} /> {details.google.rating.toFixed(1)} ({details.google.count})
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-2" aria-label="Loading description">
            <div className="h-3 w-11/12 animate-pulse rounded bg-parchment-deep" />
            <div className="h-3 w-9/12 animate-pulse rounded bg-parchment-deep" />
          </div>
        ) : details?.summary ? (
          <p className="text-[0.92rem] leading-relaxed">{details.summary}</p>
        ) : (
          <p className="text-sm text-ink-soft">No field notes yet for this spot. Go and explore it yourself!</p>
        )}

        {details?.photo && (
          <p className="text-[0.7rem] text-ink-soft">
            Photo:{" "}
            <a href={details.photo.pageUrl} target="_blank" rel="noopener" className="underline">
              {details.photo.artist ?? "Wikimedia Commons"}
            </a>
            {details.photo.license && `, ${details.photo.license}`}
          </p>
        )}

        {/* Lists */}
        <div className="flex flex-wrap items-center gap-2">
          <button className="pill" aria-pressed={fav} onClick={() => onToggle(FAVORITES_ID, place.id)}>
            <Heart size={15} fill={fav ? "currentColor" : "none"} className={fav ? "text-stamp" : ""} /> {fav ? "Favorite" : "Add to favorites"}
          </button>
          <button className="pill" aria-pressed={visited} onClick={toggleVisited}>
            ✅ {visited ? "Visited" : "Mark visited"}
          </button>
          {custom.map((l) => (
            <button key={l.id} className="pill" aria-pressed={l.ids.includes(place.id)} onClick={() => onToggle(l.id, place.id)}>
              {l.emoji} {l.name}
            </button>
          ))}
          <button className="pill" onClick={() => onNewList(place.id)}>
            <Plus size={14} /> New list
          </button>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          <a className="btn btn-primary" href={directionsUrl(place, me)} target="_blank" rel="noopener">
            <Navigation size={16} /> Start directions
          </a>
          {!me && (
            <button className="btn" onClick={onLocate} disabled={locating}>
              <LocateFixed size={16} /> {locating ? "Finding you…" : "Use my location"}
            </button>
          )}
          {place.website && (
            <a className="btn" href={place.website} target="_blank" rel="noopener">
              <ExternalLink size={16} /> Website
            </a>
          )}
          {details?.wikiUrl && (
            <a className="btn" href={details.wikiUrl} target="_blank" rel="noopener">
              <BookOpen size={16} /> Wikipedia
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

import type { CategoryId, Place } from "./types";

export interface Category {
  id: CategoryId;
  label: string;
  /** Scout-badge name shown on chips and the place card */
  badge: string;
  emoji: string;
  /** CSS variable holding the category colour */
  color: string;
}

export const CATEGORIES: Category[] = [
  { id: "animals", label: "Zoos & animal farms", badge: "Animal Tracker", emoji: "🦒", color: "var(--cat-animals)" },
  { id: "water", label: "Splash & swim", badge: "Water Explorer", emoji: "💦", color: "var(--cat-water)" },
  { id: "play", label: "Playgrounds & play", badge: "Castle Builder", emoji: "🛝", color: "var(--cat-play)" },
  { id: "park", label: "Parks", badge: "Trail Ranger", emoji: "🌳", color: "var(--cat-park)" },
  { id: "museum", label: "Museums", badge: "Time Traveller", emoji: "🏛️", color: "var(--cat-museum)" },
  { id: "science", label: "Science & space", badge: "Stargazer", emoji: "🔭", color: "var(--cat-science)" },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
  CategoryId,
  Category
>;

export interface Mood {
  id: string;
  label: string;
  emoji: string;
  test: (p: Place) => boolean;
}

/** Mood filters from the Phase 3 design. They narrow whatever categories are on. */
export const MOODS: Mood[] = [
  { id: "energy", label: "Burn energy", emoji: "🔥", test: (p) => p.cat === "play" || p.cat === "park" },
  {
    id: "rain",
    label: "Rain refuge",
    emoji: "🌧️",
    test: (p) =>
      p.indoor === true || p.cat === "museum" || p.cat === "science" || (p.cat === "water" && p.kind === "Indoor pool"),
  },
  { id: "splash", label: "Splash day", emoji: "💦", test: (p) => p.cat === "water" },
  {
    id: "picnic",
    label: "Picnic & relax",
    emoji: "🧺",
    test: (p) => p.cat === "park" || (p.cat === "animals" && p.indoor !== true),
  },
];

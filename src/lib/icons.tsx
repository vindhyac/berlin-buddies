import { Castle, Landmark, PawPrint, Telescope, Trees, Waves, type LucideIcon } from "lucide-react";
import type { CategoryId } from "./types";

/** Line-art doodle icons, shared by category cards and place rows (map pins use die-cut emoji). */
export const CAT_ICON: Record<CategoryId, LucideIcon> = {
  play: Castle,
  water: Waves,
  animals: PawPrint,
  museum: Landmark,
  park: Trees,
  science: Telescope,
};

/** Mustard is too light for white line-art. */
export const catInk = (id: CategoryId) => (id === "animals" ? "var(--ink)" : "#fff");

/** A category sticker for React lists (same look as a map pin). */
export function CatSticker({ id, color, size, tag }: { id: CategoryId; color: string; size: number; tag?: string }) {
  const Icon = CAT_ICON[id];
  return (
    <span className="pin shrink-0" style={{ ["--c" as any]: color, ["--fg" as any]: catInk(id), width: size, height: size }} aria-hidden>
      <Icon size={Math.round(size * 0.52)} strokeWidth={2.4} absoluteStrokeWidth />
      {tag && <span className="pin-tag">{tag}</span>}
    </span>
  );
}

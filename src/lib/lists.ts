import type { UserList } from "./types";

const KEY = "berlin-buddies.lists.v1";

export const FAVORITES_ID = "favorites";
export const VISITED_ID = "visited";

export const DEFAULT_LISTS: UserList[] = [
  { id: FAVORITES_ID, name: "Favorites", emoji: "❤️", ids: [], builtin: true },
  { id: VISITED_ID, name: "Visited", emoji: "✅", ids: [], builtin: true },
];

export function loadLists(): UserList[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_LISTS;
    const parsed = JSON.parse(raw) as UserList[];
    if (!Array.isArray(parsed)) return DEFAULT_LISTS;
    // Built-in lists always exist and always come first.
    const builtins = DEFAULT_LISTS.map((d) => ({ ...d, ids: parsed.find((l) => l.id === d.id)?.ids ?? [] }));
    return [...builtins, ...parsed.filter((l) => !l.builtin && l.id && l.name)];
  } catch {
    return DEFAULT_LISTS;
  }
}

export function saveLists(lists: UserList[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(lists));
  } catch {
    /* storage full or blocked: lists still work for this visit */
  }
}

export function newListId(): string {
  return `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// ---- Sharing: ?list=<base64url JSON> ----

interface SharedPayload {
  n: string;
  e: string;
  /** compact ids: n123 / w456 / r789 */
  i: string[];
}

const toCompact = (id: string) => id[0] + id.slice(id.indexOf("/") + 1);
const fromCompact = (c: string) =>
  ({ n: "node", w: "way", r: "relation" } as Record<string, string>)[c[0]] + "/" + c.slice(1);

function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeList(list: UserList): string {
  const payload: SharedPayload = { n: list.name, e: list.emoji, i: list.ids.map(toCompact) };
  return b64urlEncode(JSON.stringify(payload));
}

export function decodeList(param: string): Omit<UserList, "id"> | null {
  try {
    const p = JSON.parse(b64urlDecode(param)) as SharedPayload;
    if (typeof p.n !== "string" || !Array.isArray(p.i)) return null;
    const ids = p.i.filter((c) => /^[nwr]\d+$/.test(c)).map(fromCompact);
    return { name: p.n.slice(0, 60), emoji: (p.e || "📍").slice(0, 8), ids };
  } catch {
    return null;
  }
}

export function shareUrl(list: UserList, base = typeof location !== "undefined" ? location.origin + location.pathname : ""): string {
  return `${base}?list=${encodeList(list)}`;
}

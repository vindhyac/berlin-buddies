# Berlin Buddies

A free, kid-friendly map of Berlin: zoos, splash pools, playgrounds, parks, museums and science spots.
First version built from the product & design spec (14 Oct 2026). Restyled the same day to the "Scrappy DIY Scrapbook & Adventure Field Guide" UI spec.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests (area, filters, search, list sharing)
npm run build && npm start
```

Optional: copy `.env.example` to `.env` and set `GOOGLE_PLACES_API_KEY` to show Google star ratings. Without it the app stays zero-cost.

## What's in this version

- **Map** — Leaflet + OpenStreetMap tiles washed toward paper with a CSS sepia filter, plus quad-fold creases, laid on a desk. Browser-only (lazy + `ClientOnly`). Starts at zoom 12, minZoom 12, locked to the Berlin box.
- **Sticker pins** per category, slightly tilted like hand-placed die-cut stickers. Supercluster groups nearby pins into numbered stamps (sage < 10, ochre < 50, rust beyond) up to zoom 16; tap a stamp to zoom in. The selected pin grows and gets a taped label with its name and distance. Tap again or tap the map to unselect.
- **Live data** — `getBerlinFamilyPlaces` queries Overpass, racing 5 mirrors (first good answer wins, the rest are aborted, 58 s timeout), with a real User-Agent and form-encoded `data=` body. 1-hour in-memory cache. Falls back to 14 hand-picked spots if every mirror fails, with a "Try again" button.
- **Quality filters** — no name, private, closed, ended, and `disused:/abandoned:/demolished:/removed:/razed:/was:` tags are dropped. Duplicates (node + way of the same place) are merged.
- **Enrichment** — `getPlaceDetails` follows `wikipedia`/`wikidata` tags, otherwise searches Wikipedia near the place (de, then en). Photos come from the article/Wikidata image or a nearby Commons photo, with artist and licence credited. OSM facts (Free, Step-free, Ages, Hours) stand in for reviews.
- **Search** by name, address or category, German letters handled (`gorlitzer` finds Görlitzer), up to 30 results, keyboard friendly.
- **Area picker** — All Berlin / Near me (1, 2, 5 km) / 18 Kieze. Shows distances and sorts closest first.
- **Lists** — Favorites ❤️, Visited ✅, and your own lists with an emoji that shows on the pins. Stored in the browser. "+ New list" is also in the place card.
- **Sharing** — a list becomes a `?list=` link. Opening it adds a copy and shows only those places; "Show everything" clears it.
- **Top family picks** in the sidebar (spec scoring, ≥ 3, top 60).
- **Phase 3 extras** — 🎲 Spin for Adventure → "Today's Mission" card with *Accept & get directions* / *Spin again*; red-ink STAMPED badge with a burst when you mark a place Visited; mood filters 🔥 🌧️ 💦 🧺.
- **Sidebar** — a lined notebook sheet with a torn edge and washi tape: crayon category cards, quick filters, lists, and a Featured Spot (the top pick) as a paper-clipped Polaroid on kraft paper.
- **Responsive** — 340 px notebook sidebar at ≥ 1024 px; on phones the same sheet is a bottom drawer (search + category strip peek out; drag or tap the handle to pull it up).

## Changes from the spec

- **Vite 8, not Vite 7.** The current TanStack Start (1.169) requires Vite 8.
- **Bounding box query.** The §3.3 fix is built in: the Overpass query uses the Berlin bbox instead of the admin-area lookup, and there are two more mirrors.
- **Node preview server.** `npm start` runs `vite preview`. For the edge runtime, add your host's TanStack Start adapter (e.g. Cloudflare); the server code only uses `fetch`, so it is edge-safe.

## Not built yet

- A bundled snapshot of the OSM data for instant load (§3.3 option 3).
- Backlog: rainy/sunny switch, toilets & changing tables, ready-made day plans.

## Files

```
src/routes/index.tsx            page: state, filters, layout
src/routes/__root.tsx           html shell, fonts, meta
src/components/MapView.tsx      Leaflet map (browser only)
src/components/PlaceCard.tsx    photo, facts, lists, directions, STAMPED
src/components/AdventureSpinner.tsx
src/components/Controls.tsx     search, area picker, category cards/chips, moods, lists
src/components/FeaturedSpot.tsx kraft-paper featured card
src/components/NewListDialog.tsx
src/server/functions.ts         getBerlinFamilyPlaces, getPlaceDetails
src/server/overpass.ts          query, mirror race, cache, fallback
src/server/wiki.ts              Wikipedia / Commons / optional Google
src/server/fallback.ts          the 14 hand-picked spots
src/lib/*                       categories, classify + filters, area, search, score, lists
src/styles.css                  scrapbook tokens and components
```

## Deploy (free: GitHub + Netlify)

Visitors never wait for the slow live fetches. A GitHub Action runs `npm run refresh-data` every 6 hours, saves places (OpenStreetMap) and kids' events (visitBerlin) to `public/data/*.json` and commits them. Each commit makes Netlify rebuild the site. The app loads those files and only falls back to the live server functions when they're missing (e.g. a fresh local checkout).

- `npm run refresh-data` updates the snapshots by hand. If a source is down, its previous file is kept.
- `netlify.toml` holds the build settings; `@netlify/vite-plugin-tanstack-start` turns the server functions (Wikipedia details) into a Netlify Function.
- Netlify and Vercel tooling needs the TypeScript 5 JS API, so `typescript` is pinned to 5.9 and the project's TypeScript 7 is installed as `typescript-7` for `npm run typecheck`.
- To show Google ratings, add `GOOGLE_PLACES_API_KEY` under Netlify → Site configuration → Environment variables.

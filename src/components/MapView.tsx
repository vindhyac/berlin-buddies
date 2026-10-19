import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import Supercluster from "supercluster";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import "maplibre-gl/dist/maplibre-gl.css";
import { BERLIN_BBOX, BERLIN_CENTER, distanceKm, formatDistance, type LatLon } from "../lib/area";
import { paperMapStyle } from "../lib/paperMapStyle";

/** Anything that can sit on the map as a sticker: a place or an event. */
export interface MapItem {
  id: string;
  name: string;
  lat: number;
  lon: number;
  emoji: string;
  /** Second line of the callout, e.g. "Playground" or "Sat 18 Oct · 15:00" */
  kind: string;
}

export interface MapViewProps {
  items: MapItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** place id → emoji of the list it belongs to (shown on the pin) */
  tags: Map<string, string>;
  me: LatLon | null;
  /** circle to draw for "Near me" or a Kiez */
  circle: { center: LatLon; radiusKm: number } | null;
}

const PIN = 38;
const PIN_SELECTED = 58;
/** Above this zoom every place gets its own sticker. */
const CLUSTER_MAX_ZOOM = 16;

/** A small stable tilt per place, so stickers look hand-placed. */
function tilt(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 13) - 6;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function iconFor(p: MapItem, selected: boolean, tag?: string): L.DivIcon {
  const size = selected ? PIN_SELECTED : PIN;
  const tagHtml = tag ? `<span class="pin-tag">${tag}</span>` : "";
  return L.divIcon({
    className: "bb-pin-wrap",
    html: `<div class="pin${selected ? " is-selected" : ""}" style="--rot:${tilt(p.id)}deg"><span class="pin-art">${p.emoji}</span>${tagHtml}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function clusterIcon(count: number, label: string): L.DivIcon {
  const tone = count < 10 ? "--cluster-sm" : count < 50 ? "--cluster-md" : "--cluster-lg";
  const size = count < 10 ? 34 : count < 50 ? 40 : count < 150 ? 48 : 56;
  return L.divIcon({
    className: "bb-pin-wrap",
    html: `<div class="cluster" style="--c:var(${tone})">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function calloutHtml(p: MapItem, me: LatLon | null): string {
  const meta = [p.kind, me ? `${formatDistance(distanceKm(me, p))} away` : null].filter(Boolean).join(" · ");
  return `<span class="name">${escapeHtml(p.name)}</span><span class="meta">${escapeHtml(meta)}</span>`;
}

type PointProps = { id: string };

export default function MapView({ items: places, selectedId, onSelect, tags, me, circle }: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const meMarker = useRef<L.Marker | null>(null);
  const circleLayer = useRef<L.Circle | null>(null);
  const selectRef = useRef(onSelect);
  const selectedRef = useRef(selectedId);
  const renderRef = useRef<() => void>(() => {});
  selectRef.current = onSelect;
  selectedRef.current = selectedId;

  const byId = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  // Cluster everything except the selected place, which always stays its own sticker.
  const index = useMemo(() => {
    const sc = new Supercluster<PointProps>({ radius: 300, maxZoom: CLUSTER_MAX_ZOOM, minPoints: 2 });
    sc.load(
      places
        .filter((p) => p.id !== selectedId)
        .map((p) => ({
          type: "Feature" as const,
          properties: { id: p.id },
          geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
        })),
    );
    return sc;
  }, [places, selectedId]);

  // Draw what's in view: cluster stamps, single stickers and the selected one.
  renderRef.current = () => {
    const m = map.current;
    const lg = layer.current;
    if (!m || !lg) return;
    lg.clearLayers();
    const b = m.getBounds().pad(0.25);
    const zoom = Math.round(m.getZoom());
    for (const f of index.getClusters([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], zoom)) {
      const [lon, lat] = f.geometry.coordinates;
      const props = f.properties as Supercluster.ClusterProperties | PointProps;
      if ("cluster" in props && props.cluster) {
        const cid = props.cluster_id;
        const mk = L.marker([lat, lon], {
          icon: clusterIcon(props.point_count, String(props.point_count_abbreviated)),
          title: `${props.point_count} places, zoom in`,
          alt: `${props.point_count} places`,
        });
        mk.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          m.flyTo([lat, lon], Math.min(index.getClusterExpansionZoom(cid), CLUSTER_MAX_ZOOM + 1), { duration: 0.5 });
        });
        mk.addTo(lg);
      } else {
        const p = byId.get((props as PointProps).id);
        if (p) addPin(lg, p, false);
      }
    }
    if (selected) addPin(lg, selected, true);
  };

  function addPin(lg: L.LayerGroup, p: MapItem, isSelected: boolean) {
    const mk = L.marker([p.lat, p.lon], {
      icon: iconFor(p, isSelected, tags.get(p.id)),
      title: p.name,
      alt: p.name,
      riseOnHover: true,
      zIndexOffset: isSelected ? 10000 : 0,
    });
    mk.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      selectRef.current(selectedRef.current === p.id ? null : p.id);
    });
    if (isSelected) {
      mk.bindTooltip(calloutHtml(p, me), {
        permanent: true,
        direction: "top",
        offset: [0, -PIN_SELECTED / 2 - 6],
        className: "pin-callout",
      });
    }
    mk.addTo(lg);
  }

  // Create the map once.
  useEffect(() => {
    if (!el.current || map.current) return;
    const bounds = L.latLngBounds([BERLIN_BBOX.south, BERLIN_BBOX.west], [BERLIN_BBOX.north, BERLIN_BBOX.east]);
    const m = L.map(el.current, {
      center: [BERLIN_CENTER.lat, BERLIN_CENTER.lon],
      zoom: 12,
      minZoom: 12,
      maxZoom: 19,
      maxBounds: bounds.pad(0.04),
      maxBoundsViscosity: 1,
      zoomControl: false,
    });
    L.control.zoom({ position: "bottomright" }).addTo(m);
    maplibreGL({ style: paperMapStyle, interactive: false } as any).addTo(m);
    m.attributionControl.setPrefix(false);
    m.on("click", () => selectRef.current(null));
    m.on("moveend", () => renderRef.current());
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // Redraw when the places, list tags, selection or location change.
  useEffect(() => {
    renderRef.current();
  }, [index, byId, tags, selected, me]);

  // Bring the selected pin into view.
  useEffect(() => {
    const m = map.current;
    if (!m || !selected) return;
    const ll = L.latLng(selected.lat, selected.lon);
    if (!m.getBounds().pad(-0.15).contains(ll) || m.getZoom() < 14) {
      m.flyTo(ll, Math.max(m.getZoom(), 15), { duration: 0.6 });
    }
  }, [selected?.id]);

  // "You are here" dot.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    meMarker.current?.remove();
    meMarker.current = null;
    if (me) {
      meMarker.current = L.marker([me.lat, me.lon], {
        icon: L.divIcon({ className: "bb-pin-wrap", html: '<div class="me-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
        interactive: false,
        keyboard: false,
        zIndexOffset: 9000,
      }).addTo(m);
    }
  }, [me]);

  // Area circle (Near me / Kiez) and zoom to it.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    circleLayer.current?.remove();
    circleLayer.current = null;
    if (circle) {
      const c = L.circle([circle.center.lat, circle.center.lon], {
        radius: circle.radiusKm * 1000,
        color: "#3b604b",
        weight: 2,
        dashArray: "6 6",
        fillColor: "#e29837",
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(m);
      circleLayer.current = c;
      m.flyToBounds(c.getBounds(), { padding: [24, 24], duration: 0.6 });
    }
  }, [circle?.center.lat, circle?.center.lon, circle?.radiusKm]);

  return (
    <div className="map-sheet">
      <div ref={el} className="map-inner" role="application" aria-label="Map of family places in Berlin" />
      <div className="map-folds" aria-hidden />
    </div>
  );
}

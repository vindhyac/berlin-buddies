import type { StyleSpecification } from "maplibre-gl";

/**
 * A hand-drawn "folded paper map" base: beige land, white roads, sage parks, slate-blue water,
 * dashed rail lines and a few district names. No shops, bus stops or house numbers, so the
 * stickers on top stay readable. Vector data from OpenFreeMap (OpenMapTiles schema, no API key).
 */
const C = {
  land: "#ece2c9",
  landDeep: "#e3d6b8",
  park: "#b9cfa3",
  wood: "#98b98a",
  parkEdge: "#7f9f72",
  water: "#a3c6d1",
  waterEdge: "#6f9fb0",
  road: "#fbf8f0",
  roadEdge: "#d6c9a8",
  rail: "#5b5446",
  building: "#e0d3b4",
  label: "#6b6254",
  halo: "#f3ecda",
};

const lines = ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false] as any;
const notTunnel = ["!=", ["get", "brunnel"], "tunnel"] as any;
const roadClass = (...classes: string[]) => ["match", ["get", "class"], classes, true, false] as any;
/** Motorways and primaries from the start, secondaries from z13, tertiaries from z14. */
const majorAt = [
  "step",
  ["zoom"],
  roadClass("motorway", "trunk", "primary"),
  13,
  roadClass("motorway", "trunk", "primary", "secondary"),
  14,
  roadClass("motorway", "trunk", "primary", "secondary", "tertiary"),
] as any;
const zw = (...stops: number[]) => ["interpolate", ["exponential", 1.4], ["zoom"], ...stops] as any;

export const paperMapStyle: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    omt: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
      attribution:
        '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    { id: "land", type: "background", paint: { "background-color": C.land } },
    {
      id: "residential",
      type: "fill",
      source: "omt",
      "source-layer": "landuse",
      filter: roadClass("residential", "suburb", "neighbourhood"),
      paint: { "fill-color": C.landDeep, "fill-opacity": 0.45 },
    },
    {
      id: "grass",
      type: "fill",
      source: "omt",
      "source-layer": "landcover",
      filter: roadClass("grass", "farmland", "wetland"),
      paint: { "fill-color": C.park, "fill-opacity": 0.7 },
    },
    {
      id: "park",
      type: "fill",
      source: "omt",
      "source-layer": "park",
      paint: { "fill-color": C.park, "fill-outline-color": C.parkEdge },
    },
    {
      id: "wood",
      type: "fill",
      source: "omt",
      "source-layer": "landcover",
      filter: roadClass("wood", "forest"),
      paint: { "fill-color": C.wood, "fill-outline-color": C.parkEdge },
    },
    {
      id: "cemetery",
      type: "fill",
      source: "omt",
      "source-layer": "landuse",
      filter: roadClass("cemetery", "pitch", "playground"),
      paint: { "fill-color": C.park, "fill-opacity": 0.75 },
    },
    {
      id: "river",
      type: "line",
      source: "omt",
      "source-layer": "waterway",
      filter: ["all", notTunnel, roadClass("river", "canal")],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": C.water, "line-width": zw(10, 1.5, 14, 4, 18, 14) },
    },
    {
      id: "water-edge",
      type: "line",
      source: "omt",
      "source-layer": "water",
      filter: notTunnel,
      paint: { "line-color": C.waterEdge, "line-width": zw(10, 0.6, 16, 1.6), "line-opacity": 0.8 },
    },
    { id: "water", type: "fill", source: "omt", "source-layer": "water", filter: notTunnel, paint: { "fill-color": C.water } },
    {
      id: "building",
      type: "fill",
      source: "omt",
      "source-layer": "building",
      minzoom: 15,
      paint: { "fill-color": C.building, "fill-outline-color": C.roadEdge, "fill-opacity": 0.7 },
    },
    {
      id: "road-minor",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      minzoom: 14.5,
      filter: ["all", lines, notTunnel, roadClass("minor", "service")],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": C.road, "line-width": zw(14.5, 0.8, 16, 4, 19, 14) },
    },
    {
      id: "path",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      minzoom: 15,
      filter: ["all", lines, notTunnel, roadClass("path", "track")],
      paint: { "line-color": C.parkEdge, "line-width": 1.2, "line-dasharray": [2, 2] },
    },
    {
      id: "road-major-edge",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      filter: ["all", lines, notTunnel, majorAt],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": C.roadEdge, "line-width": zw(10, 1.4, 13, 3.4, 16, 10, 19, 26) },
    },
    {
      id: "road-major",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      filter: ["all", lines, notTunnel, majorAt],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": C.road, "line-width": zw(10, 0.8, 13, 2.4, 16, 8, 19, 22) },
    },
    {
      // S-Bahn ring and main lines drawn as dashed ink, like the mockup
      id: "rail",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      filter: ["all", lines, notTunnel, ["==", ["get", "class"], "rail"], ["!", ["has", "service"]]],
      paint: { "line-color": C.rail, "line-width": zw(10, 0.8, 14, 1.4, 18, 2.2), "line-dasharray": [3, 2.5], "line-opacity": 0.7 },
    },
    {
      id: "water-name",
      type: "symbol",
      source: "omt",
      "source-layer": "water_name",
      minzoom: 13,
      filter: lines,
      layout: {
        "symbol-placement": "line",
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Italic"],
        "text-size": 11,
        "text-letter-spacing": 0.1,
      },
      paint: { "text-color": C.waterEdge, "text-halo-color": C.water, "text-halo-width": 1 },
    },
    {
      id: "district",
      type: "symbol",
      source: "omt",
      "source-layer": "place",
      filter: roadClass("suburb", "quarter"),
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Italic"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 15, 13],
        "text-letter-spacing": 0.06,
        "text-padding": 40,
        "text-max-width": 8,
      },
      paint: { "text-color": C.label, "text-halo-color": C.halo, "text-halo-width": 1.5, "text-opacity": 0.85 },
    },
    {
      id: "street-name",
      type: "symbol",
      source: "omt",
      "source-layer": "transportation_name",
      minzoom: 15,
      filter: roadClass("primary", "secondary", "tertiary", "minor"),
      layout: {
        "symbol-placement": "line",
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 11,
      },
      paint: { "text-color": C.label, "text-halo-color": C.road, "text-halo-width": 1.5 },
    },
  ],
};

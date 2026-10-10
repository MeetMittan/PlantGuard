# ADR 0004 — Leaflet with configurable OSM-compatible tiles, no tile caching

- **Status:** Accepted (2026-10-10)

## Context

The explorer needs an interactive map without a mandatory paid API, must work (degraded) offline,
and must respect tile provider policies.

## Decision

- Leaflet 1.9 + React Leaflet 5, lazy-loaded on the Explorer route only.
- Tile URL, attribution and max zoom via env vars behind a small provider module; default OSMF
  tiles with visible attribution.
- No service-worker caching or pre-download of tiles; saved places and observation points are
  always available as a list from IndexedDB.
- Geolocation only on explicit user action.
- Nearby discovery deferred (fair-use public APIs need a throttling/caching design).

## Consequences

- ✅ Free to run, provider-swappable, policy-compliant, explorer usable without tiles.
- ⚠ No offline basemap. High-traffic deployments should switch tile providers.

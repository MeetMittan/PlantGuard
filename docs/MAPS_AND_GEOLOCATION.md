# Maps & geolocation

## Tile provider

The Nature Explorer uses [Leaflet](https://leafletjs.com) 1.9 via React Leaflet 5, loaded lazily
only on the Explorer screen. Tiles come from a configurable raster provider
(`src/services/maps/map-provider.ts`):

```env
VITE_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
VITE_MAP_ATTRIBUTION=          # required for any non-default provider
VITE_MAP_MAX_ZOOM=19
```

Default: the OpenStreetMap Foundation (OSMF) standard tile service with the attribution
"© OpenStreetMap contributors" linked to `https://www.openstreetmap.org/copyright`. The
attribution is always visible in the map corner (Leaflet attribution control), and the screen
also explains the source in text.

### Usage policy

The OSMF tile service is **not** a free, unlimited production map API. Its
[tile usage policy](https://operations.osmfoundation.org/policies/tiles/) requires, among other
things, clear attribution, a valid HTTP User-Agent/Referer (browsers send these), and no bulk
downloading or offline pre-seeding; heavy use can be blocked without notice. PlantGuard complies
by: loading tiles only while a user views the map, not pre-fetching, not caching tiles in the
service worker, and capping zoom at 19.

For a busy production deployment, switch to a provider whose terms fit your traffic (several
offer free tiers with an API key that is *meant to be public* and restricted by domain) or host
your own tiles, and set `VITE_MAP_ATTRIBUTION` accordingly. Paid map services are never required.

## Offline behaviour

- Saved places and observation coordinates are stored in IndexedDB and always shown in the list
  next to the map, with a detail panel — the explorer is fully usable without tiles.
- When offline (or when tiles fail to load), a notice explains that the background map needs
  internet. Markers still render on a blank map; the rest of the app is unaffected.
- No offline basemap is promised or provided.

## Geolocation

- Location is requested **only** when the user presses *My location*, *Use my current location*
  or *Attach my location* (scanner). Opening the map never triggers a request — this is checked by
  `tests/e2e/navigation.spec.ts`.
- `getCurrentPosition` (`src/services/geolocation/geolocation.ts`) uses `enableHighAccuracy`,
  a 15 s timeout and accepts a cached fix up to 60 s old.
- Errors are typed and explained: permission denied (with how to re-enable), unavailable,
  timeout, unsupported browser, insecure context (HTTP), or disabled by configuration.
- Alternatives always exist: tap the map to choose a point or type coordinates.
- `VITE_ENABLE_GEOLOCATION=false` hides all location buttons.

## Location privacy

- Coordinates are stored only with places or observations the user explicitly saves, only on the
  device, and are included in exported backups (the export screen warns about this).
- Photos are re-encoded before storage, which strips EXIF GPS data from camera images.
- Tile requests reveal the viewed map area and the user's IP address to the tile provider, as with
  any web map.

## Nearby park discovery

Not implemented in the MVP. Public sources such as the Overpass API (OSM data) have fair-use
limits and no SLA; doing this responsibly needs request throttling, caching, timeouts, response
validation and attribution. It is listed in [ROADMAP.md](ROADMAP.md) as an optional, online-only
extension. The explorer is complete for saved places and observation points without it.

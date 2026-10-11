# PlantGuard AI — Nature Explorer, Maps & Location Privacy

PlantGuard AI includes a **Nature Explorer** feature built with [Leaflet](https://leafletjs.com/) and [OpenStreetMap](https://www.openstreetmap.org/), allowing gardeners and foragers to record wild plants, community gardens, and botanical discoveries while respecting strict location privacy standards.

---

## 1. Privacy Principles

1. **Explicit Consent Only:** PlantGuard AI **never** requests device GPS coordinates passively or on page load. Geolocation is invoked strictly when the user clicks the "Use Current Location" or "Center Map" button.
2. **Private by Default:** All saved places have `isPublic: false` by default. They are visible solely to the authenticated owner.
3. **No Third-Party Analytics Tracking:** Location coordinates are never sent to third-party ad networks, telemetry trackers, or external map vendors beyond tile requests.
4. **Local Obfuscation Option:** Users can drop pins manually on the map without sharing their exact device GPS coordinates.

---

## 2. Technology Stack & Integration

### 2.1 Leaflet & OpenStreetMap
- **Map Engine:** Leaflet 1.9+ (`leaflet` and `@types/leaflet`).
- **Tile Server:** OpenStreetMap standard tile layer (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`).
- **Attribution:** Rendered conspicuously in the Leaflet attribution control:
  ```text
  © OpenStreetMap contributors
  ```
  in full accordance with the [OpenStreetMap Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/).

### 2.2 Offline Tile Caching
- **Workbox Cache:** In `client/vite.config.ts`, tile requests matching `tile.openstreetmap.org` are intercepted and cached locally:
  - **Strategy:** `CacheFirst`
  - **Cache Name:** `osm-tiles-cache`
  - **Expiration:** Maximum 300 entries, 30 days retention.
- When offline, gardeners can view previously browsed map sectors seamlessly.

---

## 3. Server-Side Geospatial Queries (`server/src/modules/maps`)

### 3.1 Data Model (`SavedPlace.ts`)
```typescript
{
  ownerId: ObjectId,
  title: String,
  description: String,
  latitude: Number,  // -90 to +90
  longitude: Number, // -180 to +180
  isPublic: Boolean, // default: false
  tags: [String]
}
```

### 3.2 Bounding Box Filtering
The endpoint `GET /api/v1/maps/places` supports dynamic bounding box queries for efficient viewport rendering:
```http
GET /api/v1/maps/places?bounds=52.50,13.35,52.55,13.45
```
The server query filters records:
```typescript
const filter: FilterQuery<SavedPlaceDocument> = {
  $or: [{ ownerId: req.userId }, { isPublic: true }],
  latitude: { $gte: minLat, $lte: maxLat },
  longitude: { $gte: minLng, $lte: maxLng }
};
```
This ensures high query performance without scanning unnecessary geographic clusters.


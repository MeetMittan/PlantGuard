import { useEffect, useMemo, useRef } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getTileProvider } from '@/services/maps/map-provider';
import type { ExplorerItem } from '../types';

const DEFAULT_CENTER: LatLngExpression = [20.5937, 78.9629];

function FitToItems({ items, focus }: { items: ExplorerItem[]; focus: { lat: number; lng: number } | null }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (focus) {
      map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
      return;
    }
    if (fitted.current || items.length === 0) return;
    fitted.current = true;
    if (items.length === 1) map.setView([items[0]!.lat, items[0]!.lng], 14);
    else map.fitBounds(items.map((item) => [item.lat, item.lng]) as LatLngBoundsExpression, { padding: [32, 32], maxZoom: 15 });
  }, [items, focus, map]);
  return null;
}

function ClickToPick({ onPick }: { onPick?: ((point: { lat: number; lng: number }) => void) | undefined }) {
  useMapEvents({
    click(event) {
      onPick?.({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

/**
 * Interactive map (Leaflet). Loaded lazily only on the Explorer screen.
 * Tile failures are reported upward so the screen can show an offline notice;
 * the saved-places list keeps working regardless.
 */
export default function MapView({
  items,
  selectedId,
  focus,
  userLocation,
  onSelect,
  onPick,
  onTileError,
  onTileLoad,
}: {
  items: ExplorerItem[];
  selectedId: string | null;
  focus: { lat: number; lng: number } | null;
  userLocation: { lat: number; lng: number } | null;
  onSelect: (id: string) => void;
  onPick?: (point: { lat: number; lng: number }) => void;
  onTileError: () => void;
  onTileLoad: () => void;
}) {
  const provider = useMemo(() => getTileProvider(), []);
  const style = getComputedStyle(document.documentElement);
  const forest = style.getPropertyValue('--pg-chart-mark').trim() || '#2f8a57';
  const clay = style.getPropertyValue('--pg-clay').trim() || '#9c3d24';
  const sky = style.getPropertyValue('--pg-sky').trim() || '#285e7a';

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={4}
      maxZoom={provider.maxZoom}
      className="h-full w-full"
      attributionControl
      scrollWheelZoom
    >
      <TileLayer
        url={provider.url}
        attribution={provider.attribution}
        maxZoom={provider.maxZoom}
        eventHandlers={{ tileerror: onTileError, tileload: onTileLoad }}
      />
      <FitToItems items={items} focus={focus} />
      <ClickToPick onPick={onPick} />
      {items.map((item) => (
        <CircleMarker
          key={item.id}
          center={[item.lat, item.lng]}
          radius={item.id === selectedId ? 11 : 8}
          pathOptions={{
            color: '#ffffff',
            weight: 2,
            fillColor: item.type === 'place' ? sky : item.status === 'concern' ? clay : forest,
            fillOpacity: 0.95,
          }}
          eventHandlers={{ click: () => onSelect(item.id) }}
        >
          <Tooltip>{item.title}</Tooltip>
        </CircleMarker>
      ))}
      {userLocation ? (
        <CircleMarker center={[userLocation.lat, userLocation.lng]} radius={7} pathOptions={{ color: sky, weight: 3, fillColor: '#ffffff', fillOpacity: 1 }}>
          <Tooltip permanent direction="top">
            You are here
          </Tooltip>
        </CircleMarker>
      ) : null}
    </MapContainer>
  );
}

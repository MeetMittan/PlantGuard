import { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { CloudOff, Compass, Crosshair, ExternalLink, Info, MapPin, MapPinned, Plus, Trash2, Trees } from 'lucide-react';
import { config } from '@/app/config';
import { observationsWithLocation } from '@/db/repositories/observations';
import { createPlace, deletePlace, listPlaces } from '@/db/repositories/places';
import type { PlaceKind } from '@/db/schema';
import { PageHeader } from '@/components/layout/PageFallback';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Field, Input, SegmentedControl, Select, Textarea } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Progress';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useToast } from '@/components/feedback/Toaster';
import { HealthBadge } from '@/components/common/HealthBadge';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getCurrentPosition } from '@/services/geolocation/geolocation';
import { getTileProvider } from '@/services/maps/map-provider';
import { formatCoordinate, formatDateTime } from '@/lib/format';
import { cn, errorMessage } from '@/lib/utils';
import type { ExplorerItem } from '../types';

const MapView = lazy(() => import('../components/MapView'));

const PLACE_KINDS: Array<{ value: PlaceKind; label: string }> = [
  { value: 'park', label: 'Park' },
  { value: 'garden', label: 'Garden' },
  { value: 'farm', label: 'Farm' },
  { value: 'trail', label: 'Trail' },
  { value: 'other', label: 'Other' },
];

type Filter = 'all' | 'place' | 'observation';

export default function ExplorerPage() {
  const toast = useToast();
  const online = useOnlineStatus();
  const provider = getTileProvider();
  const places = useLiveQuery(listPlaces, []);
  const observations = useLiveQuery(observationsWithLocation, []);
  const [filter, setFilter] = useState<Filter>('all');
  const [kindFilter, setKindFilter] = useState<PlaceKind | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [tilesFailing, setTilesFailing] = useState(false);
  const [draft, setDraft] = useState<{ lat: string; lng: string; name: string; kind: PlaceKind; notes: string } | null>(null);
  const [toDelete, setToDelete] = useState<ExplorerItem | null>(null);

  const items = useMemo<ExplorerItem[]>(() => {
    const placeItems: ExplorerItem[] = (places ?? []).map((place) => ({
      id: place.id,
      type: 'place',
      title: place.name,
      subtitle: PLACE_KINDS.find((k) => k.value === place.kind)?.label ?? 'Place',
      lat: place.lat,
      lng: place.lng,
      placeKind: place.kind,
      notes: place.notes,
    }));
    const observationItems: ExplorerItem[] = (observations ?? []).map((observation) => ({
      id: observation.id,
      type: 'observation',
      title: observation.label || observation.plantSuggestion || 'Observation',
      subtitle: formatDateTime(observation.createdAt),
      lat: observation.location!.lat,
      lng: observation.location!.lng,
      status: observation.healthStatus,
      href: `/history/${observation.id}`,
    }));
    return [...placeItems, ...observationItems].filter((item) => {
      if (filter !== 'all' && item.type !== filter) return false;
      if (kindFilter !== 'all' && item.type === 'place' && item.placeKind !== kindFilter) return false;
      return true;
    });
  }, [places, observations, filter, kindFilter]);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const loading = places === undefined || observations === undefined;
  const hasAnyData = (places?.length ?? 0) + (observations?.length ?? 0) > 0;

  const locate = async () => {
    setLocating(true);
    try {
      const position = await getCurrentPosition({ enabled: config.features.geolocation });
      setUserLocation(position);
      setFocus({ lat: position.lat, lng: position.lng });
      return position;
    } catch (error) {
      toast.error('Location unavailable', errorMessage(error));
      return null;
    } finally {
      setLocating(false);
    }
  };

  const openAddPlace = async (useLocation: boolean) => {
    const base = { name: '', kind: 'park' as PlaceKind, notes: '' };
    if (useLocation) {
      const position = userLocation ?? (await locate());
      if (!position) return;
      setDraft({ ...base, lat: position.lat.toFixed(6), lng: position.lng.toFixed(6) });
    } else {
      setDraft({ ...base, lat: '', lng: '' });
    }
  };

  const savePlace = async () => {
    if (!draft) return;
    try {
      const place = await createPlace({
        name: draft.name || 'Unnamed place',
        kind: draft.kind,
        lat: Number(draft.lat),
        lng: Number(draft.lng),
        notes: draft.notes,
      });
      setDraft(null);
      setSelectedId(place.id);
      setFocus({ lat: place.lat, lng: place.lng });
      toast.success('Place saved', 'Available offline in your list.');
    } catch (error) {
      toast.error('Could not save the place', errorMessage(error));
    }
  };

  const draftValid =
    draft !== null &&
    draft.lat.trim() !== '' &&
    draft.lng.trim() !== '' &&
    Number.isFinite(Number(draft.lat)) &&
    Number.isFinite(Number(draft.lng)) &&
    Math.abs(Number(draft.lat)) <= 90 &&
    Math.abs(Number(draft.lng)) <= 180;

  return (
    <div>
      <PageHeader
        title="Nature Explorer"
        description="Your saved parks, gardens and trails, and where you recorded observations."
        action={
          <>
            {config.features.geolocation ? (
              <Button variant="secondary" icon={<Crosshair className="size-4" aria-hidden />} loading={locating} onClick={() => void locate()}>
                My location
              </Button>
            ) : null}
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => void openAddPlace(false)}>
              Add place
            </Button>
          </>
        }
      />

      {!online || tilesFailing ? (
        <div role="status" className="mb-4 flex items-start gap-2 rounded-2xl bg-sun-soft p-3 text-sm text-sun">
          <CloudOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            {online ? 'Map tiles are not loading.' : 'You are offline, so the map background cannot load.'} Your saved places and
            observation locations are still listed below.
          </p>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'place', label: 'Places' },
            { value: 'observation', label: 'Observations' },
          ]}
        />
        {filter !== 'observation' ? (
          <label className="flex items-center gap-2 text-sm text-ink-muted">
            Place type
            <select
              value={kindFilter}
              onChange={(event) => setKindFilter(event.target.value as PlaceKind | 'all')}
              className="rounded-lg border border-line-strong bg-surface-raised px-2 py-1.5 text-sm text-ink"
            >
              <option value="all">All types</option>
              {PLACE_KINDS.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="relative h-[52dvh] min-h-80 overflow-hidden lg:h-[64dvh]">
          <Suspense fallback={<Skeleton className="h-full rounded-none" />}>
            <MapView
              items={items}
              selectedId={selectedId}
              focus={focus}
              userLocation={userLocation}
              onSelect={setSelectedId}
              onPick={(point) =>
                setDraft((current) => (current ? { ...current, lat: point.lat.toFixed(6), lng: point.lng.toFixed(6) } : current))
              }
              onTileError={() => setTilesFailing(true)}
              onTileLoad={() => setTilesFailing(false)}
            />
          </Suspense>
        </Card>

        <div className="space-y-4">
          {selected ? (
            <Card>
              <CardBody className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-xl font-semibold">{selected.title}</p>
                    <p className="text-sm text-ink-muted">{selected.subtitle}</p>
                  </div>
                  {selected.type === 'observation' && selected.status ? <HealthBadge status={selected.status} /> : <Badge tone="sky">Saved place</Badge>}
                </div>
                <p className="text-xs text-ink-subtle">{formatCoordinate(selected.lat, selected.lng)}</p>
                {selected.notes ? <p className="text-sm text-ink-muted">{selected.notes}</p> : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  {selected.href ? (
                    <Link to={selected.href} className="inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline">
                      Open observation <ExternalLink className="size-3.5" aria-hidden />
                    </Link>
                  ) : (
                    <Button size="sm" variant="ghost" className="text-clay" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setToDelete(selected)}>
                      Delete place
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardBody>
              <h2 className="mb-2 font-sans text-sm font-semibold uppercase tracking-wide text-ink-muted">Saved locations</h2>
              {loading ? (
                <Skeleton className="h-32" />
              ) : !hasAnyData ? (
                <EmptyState
                  className="border-none bg-transparent px-0 py-6"
                  icon={<Compass className="size-7" />}
                  title="Nothing on the map yet"
                  description="Save a park or garden, or attach your location when saving an observation."
                  action={
                    config.features.geolocation ? (
                      <Button size="sm" icon={<MapPinned className="size-4" aria-hidden />} onClick={() => void openAddPlace(true)}>
                        Save current location
                      </Button>
                    ) : undefined
                  }
                />
              ) : items.length === 0 ? (
                <p className="py-4 text-sm text-ink-muted">No results for these filters.</p>
              ) : (
                <ul className="max-h-[44dvh] space-y-1 overflow-y-auto">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(item.id);
                          setFocus({ lat: item.lat, lng: item.lng });
                        }}
                        aria-pressed={item.id === selectedId}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors',
                          item.id === selectedId ? 'bg-forest-soft' : 'hover:bg-surface-muted',
                        )}
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-muted text-forest" aria-hidden>
                          {item.type === 'place' ? <Trees className="size-4" /> : <MapPin className="size-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{item.title}</span>
                          <span className="block truncate text-xs text-ink-subtle">
                            {item.type === 'place' ? 'Place' : 'Observation'} · {item.subtitle}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <p className="flex items-start gap-2 text-xs text-ink-subtle">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {provider.isOsmFoundationService
              ? 'Map data © OpenStreetMap contributors. The public OSM tile service has a usage policy and is not available offline; PlantGuard does not pre-download map areas.'
              : 'Map tiles come from the configured provider and need an internet connection.'}{' '}
            Your location is only requested when you press a location button and is stored only with places or observations you save.
          </p>
        </div>
      </div>

      <Dialog
        open={draft !== null}
        onClose={() => setDraft(null)}
        title="Save a place"
        description="Tap the map to set the point, use your location, or enter coordinates."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={() => void savePlace()} disabled={!draftValid}>
              Save place
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="space-y-4">
            <Field label="Name">{(props) => <Input {...props} value={draft.name} maxLength={120} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />}</Field>
            <Field label="Type">
              {(props) => (
                <Select {...props} value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as PlaceKind })}>
                  {PLACE_KINDS.map((kind) => (
                    <option key={kind.value} value={kind.value}>
                      {kind.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude">
                {(props) => <Input {...props} inputMode="decimal" value={draft.lat} onChange={(e) => setDraft({ ...draft, lat: e.target.value })} />}
              </Field>
              <Field label="Longitude">
                {(props) => <Input {...props} inputMode="decimal" value={draft.lng} onChange={(e) => setDraft({ ...draft, lng: e.target.value })} />}
              </Field>
            </div>
            {config.features.geolocation ? (
              <Button size="sm" variant="secondary" icon={<Crosshair className="size-4" aria-hidden />} loading={locating} onClick={() => void openAddPlace(true).then(() => undefined)}>
                Use my current location
              </Button>
            ) : null}
            <Field label="Notes">{(props) => <Textarea {...props} value={draft.notes} maxLength={2000} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />}</Field>
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this place?"
        description={`“${toDelete?.title ?? ''}” will be removed. Observations are not deleted.`}
        confirmLabel="Delete place"
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          await deletePlace(toDelete.id);
          setSelectedId(null);
          setToDelete(null);
          toast.success('Place deleted');
        }}
      />
    </div>
  );
}

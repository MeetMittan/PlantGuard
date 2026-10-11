import { useId, useState } from 'react';
import { MapPin, Save } from 'lucide-react';
import { config } from '@/app/config';
import type { GeoPoint, IdentificationStatus, Plant } from '@/db/schema';
import type { PlantAssessment } from '@/features/diagnosis/schemas/assessment';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/feedback/Toaster';
import { getCurrentPosition } from '@/services/geolocation/geolocation';
import { formatCoordinate } from '@/lib/format';
import { errorMessage } from '@/lib/utils';
import { isPastOrPresent, toDateTimeLocal } from '@/lib/dates';
import type { PlantAssignment, SaveOptions } from '../hooks/useScanner';

type Mode = PlantAssignment['mode'];

/**
 * Save step: link to a plant (existing or new), personal notes, observation
 * time, photo retention and optional location. A model-suggested plant name is
 * prefilled for a new plant but stored as "model-suggested" unless the user
 * edits it or explicitly confirms it.
 */
export function SaveObservationPanel({
  assessment,
  plants,
  defaultPlantId,
  defaultKeepPhoto,
  saving,
  onSave,
}: {
  assessment: PlantAssessment | null;
  plants: Plant[];
  defaultPlantId: string;
  defaultKeepPhoto: boolean;
  saving: boolean;
  onSave: (options: SaveOptions) => void;
}) {
  const toast = useToast();
  const suggestion = assessment?.plantIdentification.suggestedCommonName ?? '';
  const validDefault = plants.some((plant) => plant.id === defaultPlantId) ? defaultPlantId : '';
  const [mode, setMode] = useState<Mode>(validDefault ? 'existing' : 'none');
  const [plantId, setPlantId] = useState(validDefault || plants[0]?.id || '');
  const [newName, setNewName] = useState(suggestion);
  const [confirmed, setConfirmed] = useState(false);
  const [notes, setNotes] = useState('');
  const [observedAt, setObservedAt] = useState(() => toDateTimeLocal(new Date()));
  // Captured once (lazy initializer) so render stays pure; used for validation and the picker maximum.
  const [openedAt] = useState(() => Date.now());
  const [keepPhoto, setKeepPhoto] = useState(defaultKeepPhoto);
  const [location, setLocation] = useState<GeoPoint | null>(null);
  const [locating, setLocating] = useState(false);
  const groupId = useId();

  const identificationStatus: IdentificationStatus = confirmed
    ? 'known'
    : suggestion && newName.trim() === suggestion
      ? 'model-suggested'
      : newName.trim()
        ? 'user-entered'
        : 'unknown';

  const attachLocation = async () => {
    setLocating(true);
    try {
      setLocation(await getCurrentPosition({ enabled: config.features.geolocation }));
    } catch (error) {
      toast.error('Location unavailable', errorMessage(error));
    } finally {
      setLocating(false);
    }
  };

  const observedDate = new Date(observedAt);
  const dateValid = isPastOrPresent(observedDate, openedAt);
  const canSave = dateValid && (mode !== 'new' || newName.trim().length > 0) && (mode !== 'existing' || Boolean(plantId));

  const submit = () => {
    const assignment: PlantAssignment =
      mode === 'existing'
        ? { mode, plantId }
        : mode === 'new'
          ? { mode, name: newName.trim(), identificationStatus, commonName: suggestion && newName.trim() === suggestion ? suggestion : '' }
          : { mode: 'none' };
    onSave({ assignment, keepPhoto, location, notes, observedAt: observedDate });
  };

  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend id={groupId} className="mb-1 text-sm font-medium">
          Add to My Garden
        </legend>
        {(
          [
            ['none', 'Don’t link to a plant'],
            ['existing', 'Add to an existing plant'],
            ['new', 'Create a new plant'],
          ] as Array<[Mode, string]>
        ).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={`${groupId}-mode`}
              checked={mode === value}
              disabled={value === 'existing' && plants.length === 0}
              onChange={() => setMode(value)}
            />
            {label}
            {value === 'existing' && plants.length === 0 ? <span className="text-xs text-ink-subtle">(no plants yet)</span> : null}
          </label>
        ))}
      </fieldset>

      {mode === 'existing' ? (
        <Field label="Plant">
          {(props) => (
            <Select {...props} value={plantId} onChange={(event) => setPlantId(event.target.value)}>
              {plants.map((plant) => (
                <option key={plant.id} value={plant.id}>
                  {plant.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}

      {mode === 'new' ? (
        <div className="space-y-3 rounded-2xl border border-line p-4">
          <Field
            label="Plant name"
            hint={suggestion ? `Prefilled with the model’s unverified suggestion “${suggestion}”. Change it if you know better.` : undefined}
            error={newName.trim() ? undefined : 'Give the plant a name.'}
          >
            {(props) => <Input {...props} value={newName} maxLength={120} onChange={(event) => setNewName(event.target.value)} />}
          </Field>
          <Switch
            checked={confirmed}
            onChange={setConfirmed}
            label="I’m sure what this plant is"
            description="Marks the name as confirmed by you. Leave off if you are relying on the AI suggestion."
          />
          <p className="text-xs text-ink-subtle">
            Identity will be saved as:{' '}
            {
              {
                known: 'confirmed by you',
                'user-entered': 'entered by you',
                'model-suggested': 'AI suggestion (unverified)',
                unknown: 'unknown',
              }[identificationStatus]
            }
          </p>
        </div>
      ) : null}

      <Field label="Your notes (optional)" hint="Only you write these; they never change the AI assessment.">
        {(props) => <Textarea {...props} value={notes} maxLength={5000} onChange={(event) => setNotes(event.target.value)} />}
      </Field>

      <Field label="Observed on" hint="Used to order this plant’s timeline." error={dateValid ? undefined : 'Choose a valid date that is not in the future.'}>
        {(props) => (
          <Input {...props} type="datetime-local" value={observedAt} max={toDateTimeLocal(new Date(openedAt))} onChange={(event) => setObservedAt(event.target.value)} />
        )}
      </Field>

      <Switch
        checked={keepPhoto}
        onChange={setKeepPhoto}
        label="Keep the full photo"
        description="Needed for side-by-side timeline comparison and re-analysis. A small thumbnail is always kept."
      />

      {config.features.geolocation ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-ink-muted">
            {location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-4 text-forest" aria-hidden /> {formatCoordinate(location.lat, location.lng)}
              </span>
            ) : (
              'Location is not attached.'
            )}
          </p>
          {location ? (
            <Button size="sm" variant="ghost" onClick={() => setLocation(null)}>
              Remove location
            </Button>
          ) : (
            <Button size="sm" variant="secondary" icon={<MapPin className="size-4" aria-hidden />} loading={locating} onClick={() => void attachLocation()}>
              Attach my location
            </Button>
          )}
        </div>
      ) : null}

      <Button size="lg" className="w-full sm:w-auto" icon={<Save className="size-5" aria-hidden />} onClick={submit} loading={saving} disabled={!canSave}>
        Save observation
      </Button>
    </div>
  );
}

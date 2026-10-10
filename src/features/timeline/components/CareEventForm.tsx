import { useState } from 'react';
import { Plus } from 'lucide-react';
import { CARE_EVENT_TYPES, createCareEvent } from '@/db/repositories/care-events';
import type { CareEventType } from '@/db/schema';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { useToast } from '@/components/feedback/Toaster';
import { isPastOrPresent, toDateTimeLocal } from '@/lib/dates';
import { errorMessage } from '@/lib/utils';

export const CARE_EVENT_LABELS: Record<CareEventType, string> = {
  watering: 'Watering',
  inspection: 'Inspection',
  pruning: 'Pruning',
  'soil-check': 'Soil check',
  fertilizing: 'Fertilizing',
  note: 'Note',
  other: 'Other care',
};

/**
 * Dialog for logging a care action or a journal note on a plant. These entries
 * give context in the timeline; PlantGuard never infers that a care action
 * caused a change.
 */
export function CareEventDialog({ plantId, open, onClose, defaultType = 'watering' }: { plantId: string; open: boolean; onClose: () => void; defaultType?: CareEventType }) {
  return (
    <Dialog open={open} onClose={onClose} title="Add to plant log" description="Care actions and notes appear in this plant’s timeline.">
      {/* Mounted only while open, so the default time and validation always use the current time. */}
      {open ? <CareEventFormBody plantId={plantId} onClose={onClose} defaultType={defaultType} /> : null}
    </Dialog>
  );
}

function CareEventFormBody({ plantId, onClose, defaultType }: { plantId: string; onClose: () => void; defaultType: CareEventType }) {
  const toast = useToast();
  const [eventType, setEventType] = useState<CareEventType>(defaultType);
  const [notes, setNotes] = useState('');
  const [occurredAt, setOccurredAt] = useState(() => toDateTimeLocal(new Date()));
  // Captured once (lazy initializer) so render stays pure; used for validation and the picker maximum.
  const [openedAt] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const date = new Date(occurredAt);
  const dateValid = isPastOrPresent(date, openedAt);
  const noteMissing = eventType === 'note' && !notes.trim();

  const save = async () => {
    setSaving(true);
    try {
      await createCareEvent({ plantId, eventType, notes, occurredAt: date });
      toast.success(`${CARE_EVENT_LABELS[eventType]} logged`);
      onClose();
    } catch (error) {
      toast.error('Could not save the entry', errorMessage(error));
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Type">
        {(props) => (
          <Select {...props} value={eventType} onChange={(event) => setEventType(event.target.value as CareEventType)}>
            {CARE_EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {CARE_EVENT_LABELS[type]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="When" error={dateValid ? undefined : 'Choose a valid date that is not in the future.'}>
        {(props) => <Input {...props} type="datetime-local" value={occurredAt} max={toDateTimeLocal(new Date(openedAt))} onChange={(event) => setOccurredAt(event.target.value)} />}
      </Field>
      <Field label={eventType === 'note' ? 'Note' : 'Details (optional)'} error={noteMissing ? 'Write a note.' : undefined}>
        {(props) => (
          <Textarea
            {...props}
            value={notes}
            maxLength={2000}
            placeholder={eventType === 'note' ? 'e.g. Moved to a sunnier window. New leaves appeared.' : 'e.g. About 500 ml, soil was dry.'}
            onChange={(event) => setNotes(event.target.value)}
          />
        )}
      </Field>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => void save()} loading={saving} disabled={!dateValid || noteMissing}>
          Add entry
        </Button>
      </div>
    </div>
  );
}

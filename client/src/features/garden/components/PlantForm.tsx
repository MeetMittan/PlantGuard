import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import type { IdentificationStatus, Plant } from '@/db/schema';
import type { PlantInput } from '@/db/repositories/plants';

const optionalInterval = z
  .string()
  .trim()
  .refine((value) => value === '' || (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 365), {
    message: 'Enter a whole number of days between 1 and 365, or leave empty.',
  });

export const plantFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Give the plant a name.').max(120, 'Keep the name under 120 characters.'),
    commonName: z.string().trim().max(120),
    scientificName: z.string().trim().max(160),
    identificationStatus: z.enum(['known', 'user-entered', 'model-suggested', 'unknown']),
    notes: z.string().trim().max(2000),
    sunlight: z.enum(['full-sun', 'partial-shade', 'shade', 'unknown']),
    wateringIntervalDays: optionalInterval,
    reminderKind: z.enum(['none', 'water', 'observe']),
    reminderIntervalDays: optionalInterval,
  })
  .refine((values) => values.reminderKind === 'none' || values.reminderIntervalDays !== '', {
    message: 'Choose how often (in days) the reminder repeats.',
    path: ['reminderIntervalDays'],
  });

export type PlantFormValues = z.infer<typeof plantFormSchema>;

export const IDENTIFICATION_LABELS: Record<IdentificationStatus, string> = {
  known: 'Confirmed by you',
  'user-entered': 'Entered by you (not confirmed)',
  'model-suggested': 'AI suggestion (unverified)',
  unknown: 'Unknown',
};

export function toPlantInput(values: PlantFormValues): PlantInput {
  return {
    name: values.name,
    commonName: values.commonName,
    scientificName: values.scientificName,
    identificationStatus: values.identificationStatus,
    notes: values.notes,
    care: {
      sunlight: values.sunlight,
      wateringIntervalDays: values.wateringIntervalDays ? Number(values.wateringIntervalDays) : null,
      notes: '',
    },
    reminder:
      values.reminderKind === 'none'
        ? null
        : { enabled: true, kind: values.reminderKind, intervalDays: Number(values.reminderIntervalDays) },
  };
}

export function plantToFormValues(plant: Plant): PlantFormValues {
  return {
    name: plant.name,
    commonName: plant.commonName,
    scientificName: plant.scientificName,
    identificationStatus: plant.identificationStatus,
    notes: plant.notes,
    sunlight: plant.care.sunlight,
    wateringIntervalDays: plant.care.wateringIntervalDays?.toString() ?? '',
    reminderKind: plant.reminder?.enabled ? plant.reminder.kind : 'none',
    reminderIntervalDays: plant.reminder?.intervalDays.toString() ?? '',
  };
}

const EMPTY: PlantFormValues = {
  name: '',
  commonName: '',
  scientificName: '',
  identificationStatus: 'unknown',
  notes: '',
  sunlight: 'unknown',
  wateringIntervalDays: '',
  reminderKind: 'none',
  reminderIntervalDays: '',
};

export function PlantForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: PlantFormValues;
  submitLabel: string;
  onSubmit: (values: PlantFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PlantFormValues>({ resolver: zodResolver(plantFormSchema), defaultValues: initial ?? EMPTY });
  const reminderKind = useWatch({ control, name: 'reminderKind' });
  const currentStatus = initial?.identificationStatus;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field label="Name" error={errors.name?.message}>
        {(props) => <Input {...props} {...register('name')} placeholder="Kitchen basil" autoFocus />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Common name (optional)" error={errors.commonName?.message}>
          {(props) => <Input {...props} {...register('commonName')} placeholder="Basil" />}
        </Field>
        <Field label="Scientific name (optional)" hint="Only if you know it." error={errors.scientificName?.message}>
          {(props) => <Input {...props} {...register('scientificName')} placeholder="Ocimum basilicum" />}
        </Field>
      </div>
      <Field label="How sure is this identity?">
        {(props) => (
          <Select {...props} {...register('identificationStatus')}>
            <option value="known">{IDENTIFICATION_LABELS.known}</option>
            <option value="user-entered">{IDENTIFICATION_LABELS['user-entered']}</option>
            {currentStatus === 'model-suggested' ? <option value="model-suggested">{IDENTIFICATION_LABELS['model-suggested']}</option> : null}
            <option value="unknown">{IDENTIFICATION_LABELS.unknown}</option>
          </Select>
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Light">
          {(props) => (
            <Select {...props} {...register('sunlight')}>
              <option value="unknown">Not sure</option>
              <option value="full-sun">Full sun</option>
              <option value="partial-shade">Partial shade</option>
              <option value="shade">Shade</option>
            </Select>
          )}
        </Field>
        <Field label="Water every (days)" error={errors.wateringIntervalDays?.message}>
          {(props) => <Input {...props} {...register('wateringIntervalDays')} inputMode="numeric" placeholder="e.g. 3" />}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Reminder" hint="Shown in the app when due. Not a background notification.">
          {(props) => (
            <Select {...props} {...register('reminderKind')}>
              <option value="none">No reminder</option>
              <option value="water">Watering reminder</option>
              <option value="observe">Check-up reminder</option>
            </Select>
          )}
        </Field>
        {reminderKind !== 'none' ? (
          <Field label="Repeat every (days)" error={errors.reminderIntervalDays?.message}>
            {(props) => <Input {...props} {...register('reminderIntervalDays')} inputMode="numeric" placeholder="e.g. 7" />}
          </Field>
        ) : null}
      </div>
      <Field label="Notes" error={errors.notes?.message}>
        {(props) => <Textarea {...props} {...register('notes')} rows={3} />}
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

import { z } from 'zod';
import { plantAssessmentSchema } from '@/features/diagnosis/schemas/assessment';
import { legacyAssessmentV1Schema } from '@/features/diagnosis/schemas/legacy-v1';

/**
 * PlantGuard backup format.
 *
 * - v2 (current): observations, assessments (separate, many per observation),
 *   plants (identification status), care events, care tasks/completions,
 *   saved places, safe settings subset.
 * - v1 (read-only): observations embedded a single v1 assessment. Imported by
 *   upgrading through the same converter as the database migration.
 *
 * A backup is `plantguard-backup-<date>.zip` (manifest.json + images/,
 * thumbnails/, covers/) or a bare manifest `.json` without photos.
 * See docs/DATABASE_SCHEMA.md#backup-format.
 */

export const BACKUP_FORMAT = 'plantguard-backup';
export const BACKUP_VERSION = 2;
export const MAX_BACKUP_BYTES = 300 * 1024 * 1024;
export const MAX_RECORDS_PER_TABLE = 50_000;

const id = z.string().min(1).max(100);
const isoDate = z.iso.datetime();
const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const text = (max: number) => z.string().max(max);
const filePath = z
  .string()
  .max(200)
  .regex(/^(images|thumbnails|covers)\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/);
const table = <T extends z.ZodType>(schema: T) => z.array(schema).max(MAX_RECORDS_PER_TABLE);

const geoPoint = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().nullable(),
});

const healthStatus = z.enum(['healthy', 'concern', 'unclear', 'unassessed']);
const careTaskKind = z.enum(['water', 'health-check', 'observe', 'custom']);
const care = z.object({
  sunlight: z.enum(['full-sun', 'partial-shade', 'shade', 'unknown']),
  wateringIntervalDays: z.number().int().min(1).max(365).nullable(),
  notes: text(2000),
});
const reminder = z.object({ enabled: z.boolean(), kind: z.enum(['water', 'observe']), intervalDays: z.number().int().min(1).max(365) }).nullable();

export const backupCareTaskSchema = z.object({
  id,
  title: text(200).min(1),
  kind: careTaskKind,
  plantId: id.nullable(),
  createdAt: isoDate,
  archived: z.union([z.literal(0), z.literal(1)]),
});

export const backupCareCompletionSchema = z.object({ id, taskId: id, dayKey, completedAt: isoDate, kind: careTaskKind });

export const backupPlaceSchema = z.object({
  id,
  name: text(200).min(1),
  kind: z.enum(['park', 'garden', 'farm', 'trail', 'other']),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  notes: text(2000),
  createdAt: isoDate,
});

export const backupSettingsSchema = z
  .object({
    theme: z.enum(['system', 'light', 'dark']),
    dailyGoal: z.number().int().min(1).max(20),
    keepPhotos: z.boolean(),
    tagLocation: z.boolean(),
    displayName: text(80),
  })
  .partial();

// --- v2 ---------------------------------------------------------------------

export const backupObservationV2Schema = z.object({
  id,
  plantId: id.nullable(),
  capturedAt: isoDate.nullable(),
  observedAt: isoDate,
  createdAt: isoDate,
  updatedAt: isoDate,
  dayKey,
  label: text(200),
  context: text(2000),
  notes: text(5000),
  imageFile: filePath.nullable(),
  thumbnailFile: filePath.nullable(),
  mimeType: text(40).nullable(),
  imageWidth: z.number().int().positive().nullable(),
  imageHeight: z.number().int().positive().nullable(),
  captureSource: z.enum(['camera', 'gallery', 'imported']),
  latestAssessmentId: id.nullable(),
  location: geoPoint.nullable(),
  placeId: id.nullable(),
});

export const backupAssessmentSchema = plantAssessmentSchema.and(z.object({ observationId: id }));

export const backupPlantV2Schema = z.object({
  id,
  name: text(200).min(1),
  commonName: text(200),
  scientificName: text(200),
  identificationStatus: z.enum(['known', 'user-entered', 'model-suggested', 'unknown']),
  coverFile: filePath.nullable(),
  coverObservationId: id.nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
  notes: text(5000),
  care,
  reminder,
  archived: z.union([z.literal(0), z.literal(1)]),
  archivedAt: isoDate.nullable(),
});

export const backupCareEventSchema = z.object({
  id,
  plantId: id,
  eventType: z.enum(['watering', 'inspection', 'pruning', 'soil-check', 'fertilizing', 'note', 'other']),
  occurredAt: isoDate,
  dayKey,
  notes: text(2000),
  values: z.record(z.string().max(40), z.union([z.number(), z.string().max(200)])).nullable(),
  createdAt: isoDate,
});

export const backupManifestV2Schema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(2),
  exportedAt: isoDate,
  appVersion: text(40),
  includesPhotos: z.boolean(),
  data: z.object({
    observations: table(backupObservationV2Schema),
    assessments: table(backupAssessmentSchema),
    plants: table(backupPlantV2Schema),
    careEvents: table(backupCareEventSchema),
    careTasks: table(backupCareTaskSchema),
    careCompletions: table(backupCareCompletionSchema),
    savedPlaces: table(backupPlaceSchema),
    settings: backupSettingsSchema,
  }),
});

export type BackupManifest = z.infer<typeof backupManifestV2Schema>;

// --- v1 (import only) ---------------------------------------------------------

export const backupManifestV1Schema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(1),
  exportedAt: isoDate,
  appVersion: text(40),
  includesPhotos: z.boolean(),
  data: z.object({
    observations: table(
      z.object({
        id,
        createdAt: isoDate,
        updatedAt: isoDate,
        dayKey,
        plantId: id.nullable(),
        label: text(200),
        context: text(2000),
        notes: text(5000),
        assessment: legacyAssessmentV1Schema.nullable(),
        healthStatus,
        imageFile: filePath.nullable(),
        thumbnailFile: filePath.nullable(),
        imageWidth: z.number().int().positive().nullable(),
        imageHeight: z.number().int().positive().nullable(),
        location: geoPoint.nullable(),
        placeId: id.nullable(),
      }),
    ),
    plants: table(
      z.object({
        id,
        name: text(200).min(1),
        species: text(200),
        coverFile: filePath.nullable(),
        createdAt: isoDate,
        updatedAt: isoDate,
        notes: text(5000),
        care,
        reminder,
        archived: z.union([z.literal(0), z.literal(1)]),
      }),
    ),
    careTasks: table(backupCareTaskSchema),
    careCompletions: table(backupCareCompletionSchema),
    savedPlaces: table(backupPlaceSchema),
    settings: backupSettingsSchema,
  }),
});

export type BackupManifestV1 = z.infer<typeof backupManifestV1Schema>;

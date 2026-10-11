import type { HealthStatus, PlantAssessment } from '@/features/diagnosis/schemas/assessment';
import type { SymptomCode } from '@/features/diagnosis/symptoms';
import type { DayKey } from '@/lib/dates';

/** Entity types persisted in IndexedDB (schema v3). Dates are ISO-8601 strings. */

export interface GeoPoint {
  lat: number;
  lng: number;
  /** Accuracy radius in metres, when reported by the browser. */
  accuracy: number | null;
}

export type CaptureSource = 'camera' | 'gallery' | 'imported';

export interface Observation {
  id: string;
  /** Optional link to a plant in "My Garden". */
  plantId: string | null;
  /** When the photo was taken, if known (in-app camera captures only). */
  capturedAt: string | null;
  /** User-confirmed observation time used for timeline ordering (defaults to save time). */
  observedAt: string;
  /** Persistence timestamp — never changes, even if observedAt is edited. */
  createdAt: string;
  updatedAt: string;
  /** Local calendar day the observation was saved on (used for streaks). */
  dayKey: DayKey;
  /** User-supplied label, e.g. "Balcony tomato". */
  label: string;
  /** User-supplied context entered before analysis. */
  context: string;
  /** Personal notes, editable later. Never modifies assessments. */
  notes: string;
  /** Resized, EXIF-free JPEG. Null when the user chose not to keep photos. */
  image: Blob | null;
  /** Small preview used in lists (always stored, a few KB). */
  thumbnail: Blob | null;
  mimeType: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  /** Actual stored size of `image` in bytes. */
  imageByteSize: number | null;
  captureSource: CaptureSource;
  /** Symptom tags of the latest assessment (denormalized for search and comparison lists). */
  symptomTags: SymptomCode[];
  latestAssessmentId: string | null;
  /** Denormalized from the latest assessment for indexed filtering. */
  healthStatus: HealthStatus;
  /** Denormalized model plant-name suggestion from the latest assessment. */
  plantSuggestion: string | null;
  location: GeoPoint | null;
  placeId: string | null;
  /** Lower-cased denormalized text for search. */
  searchText: string;
  schemaVersion: 3;
}

/** Assessments live in their own table; an observation can have many (rescans never overwrite). */
export type AssessmentRecord = PlantAssessment & { observationId: string };

export type IdentificationStatus = 'known' | 'user-entered' | 'model-suggested' | 'unknown';

export interface CarePreferences {
  sunlight: 'full-sun' | 'partial-shade' | 'shade' | 'unknown';
  wateringIntervalDays: number | null;
  notes: string;
}

export interface PlantReminder {
  enabled: boolean;
  kind: 'water' | 'observe';
  intervalDays: number;
}

export interface Plant {
  id: string;
  /** Display name chosen by the user. */
  name: string;
  commonName: string;
  /** Optional; unverified unless identificationStatus is "known". */
  scientificName: string;
  identificationStatus: IdentificationStatus;
  /** User-uploaded cover thumbnail, if any. */
  cover: Blob | null;
  /** Observation whose thumbnail is used as cover, if chosen. */
  coverObservationId: string | null;
  createdAt: string;
  updatedAt: string;
  notes: string;
  care: CarePreferences;
  reminder: PlantReminder | null;
  /** 0 | 1 so it can be indexed (IndexedDB cannot index booleans). */
  archived: 0 | 1;
  archivedAt: string | null;
}

export type CareEventType = 'watering' | 'inspection' | 'pruning' | 'soil-check' | 'fertilizing' | 'note' | 'other';

/** User-authored plant history entry (care actions and journal notes). Never interpreted as evidence of recovery. */
export interface CareEvent {
  id: string;
  plantId: string;
  eventType: CareEventType;
  occurredAt: string;
  /** Local calendar day of occurredAt (counts toward the care streak). */
  dayKey: DayKey;
  notes: string;
  /** Optional structured values, e.g. { amountMl: 500 } for watering. */
  values: Record<string, number | string> | null;
  createdAt: string;
}

export type CareTaskKind = 'water' | 'health-check' | 'observe' | 'custom';

export interface CareTask {
  id: string;
  title: string;
  kind: CareTaskKind;
  plantId: string | null;
  createdAt: string;
  archived: 0 | 1;
}

export interface CareCompletion {
  id: string;
  taskId: string;
  /** Local calendar day. [taskId+dayKey] is unique, so a task counts once per day. */
  dayKey: DayKey;
  completedAt: string;
  kind: CareTaskKind;
}

export type PlaceKind = 'park' | 'garden' | 'farm' | 'trail' | 'other';

export interface SavedPlace {
  id: string;
  name: string;
  kind: PlaceKind;
  lat: number;
  lng: number;
  notes: string;
  createdAt: string;
}

export type ThemePreference = 'system' | 'light' | 'dark';
export type DevicePreference = 'auto' | 'webgpu' | 'wasm';

export interface AppSettings {
  onboardingCompleted: boolean;
  theme: ThemePreference;
  /** Minimum care actions per local day for the streak to continue. */
  dailyGoal: number;
  /** Selected model preset id (see src/ai/model-manager/presets.ts). */
  modelPresetId: string | null;
  devicePreference: DevicePreference;
  /** Keep the resized photo with each observation (thumbnail is always kept). */
  keepPhotos: boolean;
  /** Attach location to new observations (still requires a per-use action). */
  tagLocation: boolean;
  displayName: string;
}

export interface SettingRecord<K extends keyof AppSettings = keyof AppSettings> {
  key: K;
  value: AppSettings[K];
}

export interface AppMetadataRecord {
  key: string;
  value: string | number | boolean | null;
  updatedAt: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  onboardingCompleted: false,
  theme: 'system',
  dailyGoal: 1,
  modelPresetId: null,
  devicePreference: 'auto',
  keepPhotos: true,
  tagLocation: false,
  displayName: '',
};

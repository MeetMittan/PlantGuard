import { strFromU8, strToU8, unzip, zip, type Unzipped } from 'fflate';
import { db } from '@/db/database';
import type { AppSettings, AssessmentRecord, CareEvent, Observation, Plant } from '@/db/schema';
import { assessmentSearchTerms, buildObservationSearchText } from '@/db/search-text';
import { getSettings, METADATA_KEYS, setMetadata } from '@/db/repositories/settings';
import { healthStatusOf } from '@/features/diagnosis/schemas/assessment';
import { upgradeLegacyAssessment } from '@/features/diagnosis/schemas/legacy-v1';
import { sniffImageSignature } from '@/services/image-processing/image-processing';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  MAX_BACKUP_BYTES,
  backupManifestV1Schema,
  backupManifestV2Schema,
  type BackupManifest,
  type BackupManifestV1,
} from './backup-schema';

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export interface ExportOptions {
  includePhotos: boolean;
  appVersion: string;
  now?: Date;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  manifest: BackupManifest;
}

function exportableSettings(settings: AppSettings): BackupManifest['data']['settings'] {
  return {
    theme: settings.theme,
    dailyGoal: settings.dailyGoal,
    keepPhotos: settings.keepPhotos,
    tagLocation: settings.tagLocation,
    displayName: settings.displayName,
  };
}

const extensionFor = (blob: Blob) => (blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg');

export async function createBackup(options: ExportOptions): Promise<ExportResult> {
  const now = options.now ?? new Date();
  const files: Record<string, Uint8Array> = {};

  const [observations, assessments, plants, careEvents, careTasks, careCompletions, savedPlaces, settings] = await Promise.all([
    db.observations.toArray(),
    db.assessments.toArray(),
    db.plants.toArray(),
    db.careEvents.toArray(),
    db.careTasks.toArray(),
    db.careCompletions.toArray(),
    db.savedPlaces.toArray(),
    getSettings(),
  ]);

  const addFile = async (folder: 'images' | 'thumbnails' | 'covers', recordId: string, blob: Blob | null) => {
    if (!options.includePhotos || !blob) return null;
    const path = `${folder}/${recordId.replace(/[^A-Za-z0-9_-]/g, '_')}.${extensionFor(blob)}`;
    files[path] = new Uint8Array(await blob.arrayBuffer());
    return path;
  };

  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    appVersion: options.appVersion,
    includesPhotos: options.includePhotos,
    data: {
      observations: await Promise.all(
        observations.map(async (o) => ({
          id: o.id,
          plantId: o.plantId,
          capturedAt: o.capturedAt,
          observedAt: o.observedAt,
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
          dayKey: o.dayKey,
          label: o.label,
          context: o.context,
          notes: o.notes,
          imageFile: await addFile('images', o.id, o.image),
          thumbnailFile: await addFile('thumbnails', o.id, o.thumbnail),
          mimeType: o.mimeType,
          imageWidth: o.imageWidth,
          imageHeight: o.imageHeight,
          captureSource: o.captureSource,
          latestAssessmentId: o.latestAssessmentId,
          location: o.location,
          placeId: o.placeId,
        })),
      ),
      assessments,
      plants: await Promise.all(plants.map(async ({ cover, ...plant }) => ({ ...plant, coverFile: await addFile('covers', plant.id, cover) }))),
      careEvents,
      careTasks,
      careCompletions,
      savedPlaces,
      settings: exportableSettings(settings),
    },
  };

  // Validate our own output so an export can always be re-imported.
  backupManifestV2Schema.parse(manifest);

  const stamp = now.toISOString().slice(0, 10);
  let blob: Blob;
  let filename: string;
  if (options.includePhotos) {
    files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
    const zipped = await new Promise<Uint8Array>((resolve, reject) =>
      // Photos are already compressed JPEGs; level 0 avoids wasted CPU.
      zip(files, { level: 0 }, (error, data) => (error ? reject(error) : resolve(data))),
    );
    blob = new Blob([zipped as BlobPart], { type: 'application/zip' });
    filename = `plantguard-backup-${stamp}.zip`;
  } else {
    blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    filename = `plantguard-backup-${stamp}.json`;
  }
  await setMetadata(METADATA_KEYS.lastExportAt, now.toISOString());
  return { blob, filename, manifest };
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export interface ParsedBackup {
  /** Always normalized to the current format (v1 backups are upgraded). */
  manifest: BackupManifest;
  sourceVersion: number;
  /** Image blobs keyed by archive path. Only files with a verified image signature are kept. */
  files: Map<string, Blob>;
  /** Non-fatal problems found while checking relationships. */
  warnings: string[];
  summary: {
    observations: number;
    assessments: number;
    plants: number;
    careEvents: number;
    careTasks: number;
    careCompletions: number;
    savedPlaces: number;
    photos: number;
  };
}

const isZip = (bytes: Uint8Array) => bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

function unzipAsync(bytes: Uint8Array): Promise<Unzipped> {
  return new Promise((resolve, reject) =>
    unzip(
      bytes,
      {
        // Only extract what the format defines; everything else (scripts, HTML, …) is skipped unread.
        filter: (file) =>
          file.name === 'manifest.json' || /^(images|thumbnails|covers)\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(file.name),
      },
      (error, data) => (error ? reject(new BackupError('This ZIP file is damaged or not a PlantGuard backup.')) : resolve(data)),
    ),
  );
}

/** Converts a v1 manifest to v2, upgrading embedded assessments with the shared converter. */
export function upgradeManifestV1(v1: BackupManifestV1): BackupManifest {
  const assessments: AssessmentRecord[] = [];
  const observations = v1.data.observations.map((o) => {
    let latestAssessmentId: string | null = null;
    if (o.assessment) {
      const upgraded = upgradeLegacyAssessment(o.assessment, { id: `${o.id}-a1`, observationId: o.id });
      assessments.push({ ...upgraded, observationId: o.id });
      latestAssessmentId = upgraded.id;
    }
    return {
      id: o.id,
      plantId: o.plantId,
      capturedAt: null,
      observedAt: o.createdAt,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      dayKey: o.dayKey,
      label: o.label,
      context: o.context,
      notes: o.notes,
      imageFile: o.imageFile,
      thumbnailFile: o.thumbnailFile,
      mimeType: o.imageFile ? 'image/jpeg' : null,
      imageWidth: o.imageWidth,
      imageHeight: o.imageHeight,
      captureSource: 'imported' as const,
      latestAssessmentId,
      location: o.location,
      placeId: o.placeId,
    };
  });
  return {
    format: BACKUP_FORMAT,
    version: 2,
    exportedAt: v1.exportedAt,
    appVersion: v1.appVersion,
    includesPhotos: v1.includesPhotos,
    data: {
      observations,
      assessments,
      plants: v1.data.plants.map(({ species, ...plant }) => ({
        ...plant,
        commonName: '',
        scientificName: species,
        identificationStatus: species ? ('user-entered' as const) : ('unknown' as const),
        coverObservationId: null,
        archivedAt: plant.archived ? plant.updatedAt : null,
      })),
      careEvents: [],
      careTasks: v1.data.careTasks,
      careCompletions: v1.data.careCompletions,
      savedPlaces: v1.data.savedPlaces,
      settings: v1.data.settings,
    },
  };
}

function parseManifest(json: string): { manifest: BackupManifest; sourceVersion: number } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new BackupError('The backup manifest is not valid JSON.');
  }
  const format = (raw as { format?: unknown } | null)?.format;
  if (format !== BACKUP_FORMAT) throw new BackupError('This file is not a PlantGuard backup.');
  const version = (raw as { version?: unknown }).version;
  if (typeof version === 'number' && version > BACKUP_VERSION) {
    throw new BackupError('This backup was created by a newer version of PlantGuard. Please update the app first.');
  }
  const describe = (issues: Array<{ path: PropertyKey[]; message: string }>) => {
    const first = issues[0];
    return `The backup failed validation${first ? ` at ${first.path.map(String).join('.')}: ${first.message}` : '.'}`;
  };
  if (version === 1) {
    const result = backupManifestV1Schema.safeParse(raw);
    if (!result.success) throw new BackupError(describe(result.error.issues));
    return { manifest: upgradeManifestV1(result.data), sourceVersion: 1 };
  }
  const result = backupManifestV2Schema.safeParse(raw);
  if (!result.success) throw new BackupError(describe(result.error.issues));
  return { manifest: result.data, sourceVersion: 2 };
}

/** Relationship checks inside the backup. Fatal problems throw; fixable ones are reported. */
function checkRelationships(manifest: BackupManifest): string[] {
  const { data } = manifest;
  const observationIds = new Set(data.observations.map((o) => o.id));
  const assessmentIds = new Set(data.assessments.map((a) => a.id));
  const orphanAssessments = data.assessments.filter((a) => !observationIds.has(a.observationId));
  if (orphanAssessments.length) {
    throw new BackupError(`The backup contains ${orphanAssessments.length} assessment(s) that belong to no observation.`);
  }
  const badLatest = data.observations.filter((o) => o.latestAssessmentId && !assessmentIds.has(o.latestAssessmentId));
  if (badLatest.length) throw new BackupError(`${badLatest.length} observation(s) reference a missing assessment.`);
  const warnings: string[] = [];
  const duplicateIds = data.observations.length - observationIds.size;
  if (duplicateIds) throw new BackupError('The backup contains duplicate observation ids.');
  return warnings;
}

export async function parseBackupFile(file: Blob): Promise<ParsedBackup> {
  if (file.size === 0) throw new BackupError('The selected file is empty.');
  if (file.size > MAX_BACKUP_BYTES) throw new BackupError('Backups larger than 300 MB are not supported.');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const files = new Map<string, Blob>();
  let parsed: { manifest: BackupManifest; sourceVersion: number };

  if (isZip(bytes)) {
    const entries = await unzipAsync(bytes);
    const manifestBytes = entries['manifest.json'];
    if (!manifestBytes) throw new BackupError('The ZIP file does not contain a manifest.json.');
    parsed = parseManifest(strFromU8(manifestBytes));
    for (const [path, data] of Object.entries(entries)) {
      if (path === 'manifest.json') continue;
      const type = path.endsWith('.png') ? 'image/png' : path.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
      const blob = new Blob([data as BlobPart], { type });
      if (await sniffImageSignature(blob)) files.set(path, blob);
    }
  } else {
    parsed = parseManifest(new TextDecoder().decode(bytes));
  }

  const warnings = checkRelationships(parsed.manifest);
  const { data } = parsed.manifest;
  return {
    manifest: parsed.manifest,
    sourceVersion: parsed.sourceVersion,
    files,
    warnings,
    summary: {
      observations: data.observations.length,
      assessments: data.assessments.length,
      plants: data.plants.length,
      careEvents: data.careEvents.length,
      careTasks: data.careTasks.length,
      careCompletions: data.careCompletions.length,
      savedPlaces: data.savedPlaces.length,
      photos: files.size,
    },
  };
}

export type ImportMode = 'merge' | 'replace';

export interface ImportResult {
  added: number;
  skippedDuplicates: number;
  /** Plant links that pointed to plants in neither the backup nor this device (now unlinked). */
  unlinked: number;
}

/**
 * Applies a parsed backup in a single read-write transaction: if anything
 * fails, IndexedDB rolls back and existing data is untouched.
 *
 * - merge: records whose id already exists locally are kept as-is (skipped).
 *   Care completions are also de-duplicated by [taskId+dayKey].
 * - replace: all user data is cleared first (still within the transaction).
 * Observation → plant links and care events are validated against plants in
 * the backup or on the device; unresolvable links are removed, never left dangling.
 */
export async function applyBackup(parsed: ParsedBackup, mode: ImportMode): Promise<ImportResult> {
  const { data } = parsed.manifest;
  const fileOrNull = (path: string | null) => (path ? (parsed.files.get(path) ?? null) : null);
  const assessmentsById = new Map(data.assessments.map((assessment) => [assessment.id, assessment]));

  let added = 0;
  let skippedDuplicates = 0;
  let unlinked = 0;

  await db.transaction(
    'rw',
    [db.observations, db.assessments, db.plants, db.careEvents, db.careTasks, db.careCompletions, db.savedPlaces, db.settings],
    async () => {
      if (mode === 'replace') {
        await Promise.all([
          db.observations.clear(),
          db.assessments.clear(),
          db.plants.clear(),
          db.careEvents.clear(),
          db.careTasks.clear(),
          db.careCompletions.clear(),
          db.savedPlaces.clear(),
        ]);
      }

      const plantIds = new Set<string>([...data.plants.map((p) => p.id), ...((await db.plants.toCollection().primaryKeys()) as string[])]);

      const observations: Observation[] = data.observations.map(({ imageFile, thumbnailFile, ...rest }) => {
        const latest = rest.latestAssessmentId ? (assessmentsById.get(rest.latestAssessmentId) ?? null) : null;
        let plantId = rest.plantId;
        if (plantId && !plantIds.has(plantId)) {
          plantId = null;
          unlinked += 1;
        }
        const image = fileOrNull(imageFile);
        const observation: Observation = {
          ...rest,
          plantId,
          image,
          thumbnail: fileOrNull(thumbnailFile),
          imageByteSize: image ? image.size : null,
          symptomTags: latest ? latest.visibleFindings.map((finding) => finding.code) : [],
          healthStatus: healthStatusOf(latest),
          plantSuggestion: latest?.plantIdentification.suggestedCommonName ?? null,
          searchText: '',
          schemaVersion: 3,
        };
        observation.searchText = buildObservationSearchText({ ...observation, extraTerms: assessmentSearchTerms(latest) });
        return observation;
      });
      const plants: Plant[] = data.plants.map(({ coverFile, ...rest }) => ({ ...rest, cover: fileOrNull(coverFile) }));
      const careEvents: CareEvent[] = data.careEvents.filter((event) => {
        if (plantIds.has(event.plantId)) return true;
        unlinked += 1;
        return false;
      });

      const insertNew = async <T extends { id: string }>(
        tableName: 'observations' | 'assessments' | 'plants' | 'careEvents' | 'careTasks' | 'savedPlaces',
        rows: T[],
      ) => {
        const table = db.table<T, string>(tableName);
        const existing = new Set((await table.bulkGet(rows.map((row) => row.id))).filter(Boolean).map((row) => row!.id));
        const fresh = rows.filter((row) => !existing.has(row.id));
        skippedDuplicates += rows.length - fresh.length;
        added += fresh.length;
        if (fresh.length) await table.bulkAdd(fresh);
        return new Set(fresh.map((row) => row.id));
      };

      await insertNew('plants', plants);
      const freshObservations = await insertNew('observations', observations);
      // Assessments of observations that already existed locally are skipped with them.
      await insertNew(
        'assessments',
        data.assessments.filter((assessment) => freshObservations.has(assessment.observationId)),
      );
      skippedDuplicates += data.assessments.filter((assessment) => !freshObservations.has(assessment.observationId)).length;
      await insertNew('careEvents', careEvents);
      await insertNew('careTasks', data.careTasks);
      await insertNew('savedPlaces', data.savedPlaces);

      // Completions: de-duplicate by id and by the unique [taskId+dayKey] pair.
      const existingCompletions = await db.careCompletions.toArray();
      const seenIds = new Set(existingCompletions.map((c) => c.id));
      const seenPairs = new Set(existingCompletions.map((c) => `${c.taskId}|${c.dayKey}`));
      const freshCompletions = data.careCompletions.filter((completion) => {
        const pair = `${completion.taskId}|${completion.dayKey}`;
        if (seenIds.has(completion.id) || seenPairs.has(pair)) return false;
        seenIds.add(completion.id);
        seenPairs.add(pair);
        return true;
      });
      skippedDuplicates += data.careCompletions.length - freshCompletions.length;
      added += freshCompletions.length;
      if (freshCompletions.length) await db.careCompletions.bulkAdd(freshCompletions);

      if (mode === 'replace') {
        const entries = Object.entries(data.settings) as Array<[keyof AppSettings, AppSettings[keyof AppSettings]]>;
        await db.settings.bulkPut(entries.map(([key, value]) => ({ key, value })));
      }
    },
  );

  return { added, skippedDuplicates, unlinked };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { config } from '@/app/config';
import { modelManager } from '@/ai/model-manager/model-manager';
import { ModelRuntimeError } from '@/ai/utils/errors';
import { saveScan, type SaveScanResult } from '@/db/repositories/observations';
import type { CaptureSource, GeoPoint, IdentificationStatus } from '@/db/schema';
import { buildAssessment, AssessmentValidationError } from '@/features/diagnosis/services/assessment-service';
import type { PlantAssessment } from '@/features/diagnosis/schemas/assessment';
import { AppError, ERROR_CATALOGUE, type AppErrorCode } from '@/lib/app-errors';
import { createId } from '@/lib/utils';
import { ImageValidationError, prepareImage, type PreparedImage } from '@/services/image-processing/image-processing';
import { evaluateQuality, type QualityEvaluation } from '@/services/image-processing/quality';

export type ScanPhase = 'select' | 'preparing' | 'preview' | 'analyzing' | 'result' | 'saving' | 'saved';

export interface ScanDraft {
  label: string;
  context: string;
  plantId: string;
}

export interface ScanError {
  code: AppErrorCode;
  message: string;
}

export type PlantAssignment =
  | { mode: 'none' }
  | { mode: 'existing'; plantId: string }
  | { mode: 'new'; name: string; identificationStatus: IdentificationStatus; commonName: string };

export interface SaveOptions {
  assignment: PlantAssignment;
  keepPhoto: boolean;
  location: GeoPoint | null;
  notes: string;
  observedAt: Date;
}

const DRAFT_KEY = 'plantguard:scan-draft';
const EMPTY_DRAFT: ScanDraft = { label: '', context: '', plantId: '' };

/** Unsaved text inputs survive reloads (sessionStorage); photos are not persisted until saved. */
function loadDraft(initialPlantId: string | null): ScanDraft {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    const draft = raw ? { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<ScanDraft>) } : EMPTY_DRAFT;
    return initialPlantId ? { ...draft, plantId: initialPlantId } : draft;
  } catch {
    return { ...EMPTY_DRAFT, plantId: initialPlantId ?? '' };
  }
}

const IMAGE_ERROR_CODES: Record<ImageValidationError['code'], AppErrorCode> = {
  'unsupported-type': 'INVALID_IMAGE',
  'decode-failed': 'INVALID_IMAGE',
  empty: 'INVALID_IMAGE',
  'too-large': 'IMAGE_TOO_LARGE',
  'too-small': 'IMAGE_TOO_SMALL',
};

function toScanError(error: unknown, fallback: AppErrorCode): ScanError {
  if (error instanceof ImageValidationError) return { code: IMAGE_ERROR_CODES[error.code], message: error.message };
  if (error instanceof ModelRuntimeError) return { code: error.detail.code, message: error.detail.message };
  if (error instanceof AssessmentValidationError) {
    return { code: 'RESULT_VALIDATION_FAILED', message: ERROR_CATALOGUE.RESULT_VALIDATION_FAILED.message };
  }
  if (error instanceof AppError) return { code: error.code, message: error.message };
  return { code: fallback, message: ERROR_CATALOGUE[fallback].message };
}

export function useScanner(initialPlantId: string | null = null) {
  const [phase, setPhase] = useState<ScanPhase>('select');
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [quality, setQuality] = useState<QualityEvaluation | null>(null);
  const [source, setSource] = useState<{ captureSource: CaptureSource; capturedAt: string | null }>({ captureSource: 'gallery', capturedAt: null });
  const [draft, setDraftState] = useState<ScanDraft>(() => loadDraft(initialPlantId));
  const [assessment, setAssessment] = useState<PlantAssessment | null>(null);
  const [error, setError] = useState<ScanError | null>(null);
  const [saved, setSaved] = useState<SaveScanResult | null>(null);
  /** Changes whenever the photo is replaced or the scan is reset; stale async results are ignored. */
  const scanToken = useRef(0);
  /** Pre-assigned observation id for the current photo, so saving is idempotent. */
  const observationId = useRef(createId());

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Storage may be unavailable (private mode); drafts are a convenience only.
    }
  }, [draft]);

  const setDraft = useCallback((patch: Partial<ScanDraft>) => setDraftState((current) => ({ ...current, ...patch })), []);

  const selectFile = useCallback(async (file: Blob, captureSource: CaptureSource) => {
    const token = ++scanToken.current;
    observationId.current = createId();
    setError(null);
    setAssessment(null);
    setPhase('preparing');
    try {
      const prepared = await prepareImage(file, config.ai.maxImageDimension);
      if (token !== scanToken.current) return;
      setImage(prepared);
      setQuality(evaluateQuality(prepared.quality));
      setSource({ captureSource, capturedAt: captureSource === 'camera' ? new Date().toISOString() : null });
      setPhase('preview');
    } catch (err) {
      if (token !== scanToken.current) return;
      // Keep any previously prepared photo so the user does not lose it.
      setError(toScanError(err, 'IMAGE_PREPARATION_FAILED'));
      setPhase((current) => (current === 'preparing' && image ? 'preview' : 'select'));
    }
  }, [image]);

  const analyze = useCallback(async () => {
    if (!image || phase === 'analyzing') return; // duplicate taps
    if (!modelManager.canAnalyze()) {
      setError(toScanError(new ModelRuntimeError({ code: 'MODEL_NOT_DOWNLOADED', message: ERROR_CATALOGUE.MODEL_NOT_DOWNLOADED.message }), 'INFERENCE_FAILED'));
      return;
    }
    const token = scanToken.current;
    setError(null);
    setPhase('analyzing');
    try {
      const inference = await modelManager.analyze({ image: image.image, context: draft.context });
      const result = buildAssessment({ inference, quality: image.quality });
      if (token !== scanToken.current) return; // photo replaced meanwhile
      setAssessment(result);
      setPhase('result');
    } catch (err) {
      if (token !== scanToken.current) return;
      const scanError = toScanError(err, 'INFERENCE_FAILED');
      setError(scanError.code === 'REQUEST_CANCELLED' ? null : scanError);
      setPhase('preview');
    }
  }, [image, draft.context, phase]);

  const cancelAnalysis = useCallback(() => void modelManager.cancel(), []);

  const save = useCallback(
    async (options: SaveOptions) => {
      if (!image || phase === 'saving') return null;
      setError(null);
      setPhase('saving');
      try {
        const result = await saveScan({
          observation: {
            id: observationId.current,
            label: draft.label,
            context: draft.context,
            notes: options.notes,
            plantId: options.assignment.mode === 'existing' ? options.assignment.plantId : null,
            image: options.keepPhoto ? image.image : null,
            thumbnail: image.thumbnail,
            mimeType: image.mimeType,
            imageWidth: image.width,
            imageHeight: image.height,
            captureSource: source.captureSource,
            capturedAt: source.capturedAt,
            observedAt: options.observedAt,
            location: options.location,
          },
          assessment,
          ...(options.assignment.mode === 'new'
            ? {
                newPlant: {
                  name: options.assignment.name,
                  commonName: options.assignment.commonName,
                  identificationStatus: options.assignment.identificationStatus,
                },
              }
            : {}),
        });
        setSaved(result);
        setPhase('saved');
        setDraftState({ ...EMPTY_DRAFT, plantId: result.observation.plantId ?? '' });
        return result;
      } catch (err) {
        // The in-memory result is kept so the user can retry.
        setError(toScanError(err, 'DATABASE_WRITE_FAILED'));
        setPhase(assessment ? 'result' : 'preview');
        return null;
      }
    },
    [image, phase, draft, assessment, source],
  );

  /** Start over; optionally keep the plant selection (e.g. "scan this plant again"). */
  const reset = useCallback((keepPlant = true) => {
    scanToken.current += 1;
    observationId.current = createId();
    setImage(null);
    setQuality(null);
    setAssessment(null);
    setError(null);
    setSaved(null);
    if (!keepPlant) setDraftState(EMPTY_DRAFT);
    setPhase('select');
  }, []);

  return { phase, image, quality, draft, setDraft, assessment, error, setError, saved, selectFile, analyze, cancelAnalysis, save, reset };
}

import { useCallback, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'motion/react';
import { Camera, CheckCircle2, CloudOff, History, ImagePlus, Lightbulb, Loader2, RefreshCcw, Save, ScanLine, Square, Wifi, X } from 'lucide-react';
import { useModelState } from '@/ai/model-manager/useModelManager';
import { modelManager } from '@/ai/model-manager/model-manager';
import { listPlants } from '@/db/repositories/plants';
import { PageHeader } from '@/components/layout/PageFallback';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/Progress';
import { useToast } from '@/components/feedback/Toaster';
import { useObjectUrl } from '@/hooks/useObjectUrl';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { AssessmentReport } from '@/features/diagnosis/components/AssessmentReport';
import { ModelReadinessCard } from '@/features/settings/components/ModelReadinessCard';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { ACCEPTED_IMAGE_TYPES } from '@/services/image-processing/image-processing';
import { CameraCapture } from '../components/CameraCapture';
import { SaveObservationPanel } from '../components/SaveObservationPanel';
import type { CameraError } from '../services/camera';
import { useScanner } from '../hooks/useScanner';

const fade = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.2 } };

export default function ScannerPage() {
  const [params] = useSearchParams();
  const scanner = useScanner(params.get('plantId'));
  const model = useModelState();
  const online = useOnlineStatus();
  const { settings } = useSettings();
  const toast = useToast();
  const navigate = useNavigate();
  const plants = useLiveQuery(() => listPlants(), []);
  const fileInput = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);
  const previewUrl = useObjectUrl(scanner.image?.image);
  const { setError } = scanner;

  const isGemini = model.providerKind === 'gemini';

  const onCameraError = useCallback((error: CameraError) => setError({ code: 'INVALID_IMAGE', message: error.message }), [setError]);
  const closeCamera = useCallback(() => setCameraOpen(false), []);

  const modelReady = model.state === 'ready' || model.state === 'running';
  const selectedPlant = plants?.find((plant) => plant.id === scanner.draft.plantId);
  const { phase } = scanner;
  const qualityProblem = scanner.quality && scanner.quality.verdict !== 'suitable' && scanner.quality.verdict !== 'unknown';

  const onAnalyzeClick = useCallback(() => {
    if (isGemini) {
      const consentGiven = localStorage.getItem('plantguard:gemini-consent-accepted') === '1';
      if (!consentGiven) {
        setConsentDialogOpen(true);
        return;
      }
    }
    void scanner.analyze();
  }, [isGemini, scanner]);

  const onConfirmConsent = useCallback(() => {
    localStorage.setItem('plantguard:gemini-consent-accepted', '1');
    setConsentDialogOpen(false);
    void scanner.analyze();
  }, [scanner]);

  return (
    <div>
      <PageHeader
        title={selectedPlant ? `Scan ${selectedPlant.name}` : 'Scan a plant'}
        description={
          isGemini
            ? 'Photograph a single leaf in good light. Analysis runs via Google Gemini API.'
            : 'Photograph a single leaf in good light. Analysis runs entirely on this device, online or offline.'
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs" aria-live="polite">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-ink-muted">
          {online ? <Wifi className="size-3.5" aria-hidden /> : <CloudOff className="size-3.5" aria-hidden />}
          {online ? 'Online' : 'Offline'}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-ink-muted">
          {modelReady ? <CheckCircle2 className="size-3.5 text-forest" aria-hidden /> : <Loader2 className="size-3.5" aria-hidden />}
          {modelReady
            ? online
              ? isGemini
                ? 'AI ready (Gemini Cloud)'
                : 'AI ready'
              : isGemini
                ? 'AI offline (internet required)'
                : 'AI ready — works offline'
            : isGemini
              ? 'AI not ready'
              : 'AI not downloaded'}
        </span>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid="photo-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void scanner.selectFile(file, 'gallery');
        }}
      />

      {scanner.error ? (
        <div role="alert" className="mb-4 flex items-start gap-3 rounded-2xl border border-clay/30 bg-clay-soft p-4 text-sm text-clay">
          <X className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="flex-1">
            <p>{scanner.error.message}</p>
              {scanner.error.code === 'INSUFFICIENT_STORAGE' ? (
                <p className="mt-2">Your photo and result are still here. Turn off “Keep the full photo” below and retry, or free device storage. Existing observations are kept.</p>
              ) : null}
            <p className="mt-1 text-xs opacity-80">Error code: {scanner.error.code}</p>
          </div>
          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
            {scanner.image && phase === 'preview' ? (
              <button type="button" onClick={() => void onAnalyzeClick()} className="font-semibold underline">
                Retry
              </button>
            ) : null}
            <button type="button" onClick={() => scanner.setError(null)} className="font-medium underline opacity-80 hover:opacity-100">
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        {phase === 'select' || phase === 'preparing' ? (
          <motion.div key="select" {...fade} className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <Card className="p-6 sm:p-8">
              <div className="grid place-items-center rounded-2xl border-2 border-dashed border-line-strong bg-surface-muted/50 px-6 py-12 text-center">
                <div className="grid size-16 place-items-center rounded-2xl bg-forest-soft text-forest" aria-hidden>
                  {phase === 'preparing' ? <Loader2 className="size-8 animate-spin" /> : <ScanLine className="size-8" />}
                </div>
                <p className="mt-4 font-display text-xl font-semibold">{phase === 'preparing' ? 'Preparing photo…' : 'Add a leaf photo'}</p>
                <p className="mt-1 max-w-sm text-sm text-ink-muted">
                  JPEG, PNG or WebP up to 25 MB. Photos are checked, resized and stripped of camera metadata (including GPS) on this device.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <Button size="lg" icon={<Camera className="size-5" aria-hidden />} onClick={() => setCameraOpen(true)} disabled={phase === 'preparing'}>
                    Take photo
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    icon={<ImagePlus className="size-5" aria-hidden />}
                    onClick={() => fileInput.current?.click()}
                    disabled={phase === 'preparing'}
                  >
                    Choose photo
                  </Button>
                </div>
              </div>
            </Card>
            <div className="space-y-4">
              {!modelReady ? <ModelReadinessCard compact /> : null}
              <Card className="p-5">
                <h2 className="flex items-center gap-2 font-sans text-base font-semibold">
                  <Lightbulb className="size-5 text-sun" aria-hidden /> Tips for a useful photo
                </h2>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-ink-muted">
                  <li>One leaf fills most of the frame, in sharp focus.</li>
                  <li>Soft daylight — avoid harsh shadows and flash glare.</li>
                  <li>Include both healthy and affected areas.</li>
                  <li>Photograph the underside too if you see spots or powder.</li>
                  <li>For a plant’s timeline, try to use a similar angle and distance each time.</li>
                </ul>
              </Card>
            </div>
          </motion.div>
        ) : null}

        {(phase === 'preview' || phase === 'analyzing' || phase === 'result' || phase === 'saving') && scanner.image ? (
          <motion.div key="work" {...fade} className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-4">
              <Card className="overflow-hidden">
                {previewUrl ? (
                  <img src={previewUrl} alt="Selected leaf photo" className="aspect-[4/3] w-full bg-surface-muted object-contain" />
                ) : null}
                <CardBody className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-ink-subtle">
                    {scanner.image.width} × {scanner.image.height} px · metadata removed
                  </span>
                  {phase === 'preview' || phase === 'result' ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" icon={<Camera className="size-4" aria-hidden />} onClick={() => setCameraOpen(true)}>
                        Retake
                      </Button>
                      <Button size="sm" variant="secondary" icon={<ImagePlus className="size-4" aria-hidden />} onClick={() => fileInput.current?.click()}>
                        Replace
                      </Button>
                    </div>
                  ) : null}
                </CardBody>
              </Card>
              {qualityProblem && phase === 'preview' ? (
                <div role="note" className="space-y-1 rounded-2xl bg-sun-soft p-4 text-sm text-sun">
                  <p className="font-semibold">Photo check (automatic, approximate)</p>
                  <ul className="list-disc pl-5">
                    {scanner.quality!.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                  <p className="text-xs">Retaking usually gives a more useful result, but you can still analyse this photo.</p>
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              {phase === 'preview' ? (
                <Card>
                  <CardBody className="space-y-4">
                    <Field label="Name for this observation (optional)" hint="e.g. “Balcony tomato, lower leaf”.">
                      {(props) => (
                        <Input {...props} value={scanner.draft.label} maxLength={120} onChange={(e) => scanner.setDraft({ label: e.target.value })} />
                      )}
                    </Field>
                    <Field
                      label="Context for the AI (optional)"
                      hint={
                        isGemini
                          ? 'What you noticed and when. Sent securely with your photo to Gemini.'
                          : 'What you noticed and when. Only the on-device model sees it.'
                      }
                    >
                      {(props) => (
                        <Textarea
                          {...props}
                          value={scanner.draft.context}
                          maxLength={200}
                          onChange={(e) => scanner.setDraft({ context: e.target.value })}
                          placeholder="Spots appeared after a rainy week"
                        />
                      )}
                    </Field>
                    {plants?.length ? (
                      <Field label="Plant" hint="You can also choose or create a plant when saving.">
                        {(props) => (
                          <Select {...props} value={scanner.draft.plantId} onChange={(e) => scanner.setDraft({ plantId: e.target.value })}>
                            <option value="">Not linked yet</option>
                            {plants.map((plant) => (
                              <option key={plant.id} value={plant.id}>
                                {plant.name}
                              </option>
                            ))}
                          </Select>
                        )}
                      </Field>
                    ) : null}
                    {modelReady ? (
                      <Button size="lg" className="w-full" icon={<ScanLine className="size-5" aria-hidden />} onClick={onAnalyzeClick}>
                        {qualityProblem ? 'Analyse anyway' : isGemini ? 'Analyse with Gemini AI' : 'Analyse on this device'}
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        {isGemini ? (
                          <div className="space-y-2 rounded-2xl border border-line bg-surface-muted/50 p-4">
                            <p className="font-semibold text-ink">Cloud AI unavailable</p>
                            <p className="text-sm text-ink-muted">
                              {!online
                                ? 'You are offline. Google Gemini cloud analysis requires an active internet connection.'
                                : 'Could not connect to the Gemini backend API. Please make sure the Express server is running.'}
                            </p>
                            <Button variant="secondary" size="sm" icon={<RefreshCcw className="size-4" aria-hidden />} onClick={() => void modelManager.refresh()} disabled={!online}>
                              Retry connection
                            </Button>
                          </div>
                        ) : (
                          <ModelReadinessCard compact />
                        )}
                        <p className="text-sm text-ink-muted">You can still save this photo now and analyse it later from its observation page.</p>
                      </div>
                    )}
                  </CardBody>
                </Card>
              ) : null}

              {phase === 'preview' && !modelReady ? (
                <Card>
                  <CardHeader title="Save without analysis" />
                  <CardBody>
                    <SaveObservationPanel
                      assessment={null}
                      plants={plants ?? []}
                      defaultPlantId={scanner.draft.plantId}
                      defaultKeepPhoto={true}
                      saving={false}
                      onSave={(options) => void scanner.save(options)}
                    />
                  </CardBody>
                </Card>
              ) : null}

              {phase === 'analyzing' ? (
                <Card>
                  <CardBody className="space-y-4" aria-live="polite">
                    <div className="flex items-center gap-3">
                      <Loader2 className="size-6 animate-spin text-forest" aria-hidden />
                      <div>
                        <p className="font-semibold">{isGemini ? 'Analysing with Gemini AI…' : 'Analysing on your device…'}</p>
                        <p className="text-sm text-ink-muted">
                          {model.analysisStep
                            ? `Step ${model.analysisStep.index + 1} of ${model.analysisStep.total}: ${model.analysisStep.label}`
                            : isGemini
                              ? 'Connecting to Gemini AI backend…'
                              : model.state === 'loading'
                                ? 'Starting the model from local storage…'
                                : 'Preparing…'}
                        </p>
                      </div>
                    </div>
                    <ProgressBar
                      value={model.analysisStep ? ((model.analysisStep.index + 0.5) / model.analysisStep.total) * 100 : null}
                      label="Analysis progress"
                    />
                    <p className="text-xs text-ink-subtle">
                      {isGemini
                        ? 'Your photo is securely sent to Google Gemini for plant health analysis. You can cancel at any time.'
                        : 'Your photo stays on this device. This can take from a few seconds to a few minutes on phones. Leaving this screen may interrupt the analysis.'}
                    </p>
                    <Button variant="secondary" icon={<Square className="size-4" aria-hidden />} onClick={scanner.cancelAnalysis}>
                      Cancel
                    </Button>
                  </CardBody>
                </Card>
              ) : null}

              {(phase === 'result' || phase === 'saving') && scanner.assessment ? (
                <>
                  <Card>
                    <CardBody>
                      <AssessmentReport assessment={scanner.assessment} />
                    </CardBody>
                  </Card>
                  <Card>
                    <CardHeader title="Save this observation" description="Not saved yet — the result is only in memory until you save it." />
                    <CardBody>
                      <SaveObservationPanel
                        assessment={scanner.assessment}
                        plants={plants ?? []}
                        defaultPlantId={scanner.draft.plantId}
                        defaultKeepPhoto={settings.keepPhotos}
                        saving={phase === 'saving'}
                        onSave={(options) =>
                          void scanner.save(options).then((result) => {
                            if (result) toast.success('Observation saved', result.alreadySaved ? 'It was already saved.' : 'It counts toward today’s care streak.');
                          })
                        }
                      />
                      <Button className="mt-3" variant="ghost" icon={<RefreshCcw className="size-4" aria-hidden />} onClick={() => scanner.reset()}>
                        Discard and rescan
                      </Button>
                    </CardBody>
                  </Card>
                </>
              ) : null}
            </div>
          </motion.div>
        ) : null}

        {phase === 'saved' && scanner.saved ? (
          <motion.div key="saved" {...fade}>
            <Card className="mx-auto max-w-lg p-8 text-center">
              <div className="mx-auto grid size-16 place-items-center rounded-full bg-forest-soft text-forest" aria-hidden>
                <CheckCircle2 className="size-8" />
              </div>
              <h2 className="mt-4 text-2xl font-semibold">Observation saved</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Stored on this device{scanner.saved.plant ? ` and added to ${scanner.saved.plant.name}` : ''}. Available offline.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button icon={<Save className="size-4" aria-hidden />} onClick={() => navigate(`/history/${scanner.saved!.observation.id}`)}>
                  View observation
                </Button>
                {scanner.saved.observation.plantId ? (
                  <ButtonLink to={`/garden/${scanner.saved.observation.plantId}/timeline`} variant="secondary" icon={<History className="size-4" aria-hidden />}>
                    Open plant timeline
                  </ButtonLink>
                ) : null}
                <Button variant="secondary" icon={<ScanLine className="size-4" aria-hidden />} onClick={() => scanner.reset(true)}>
                  Scan another
                </Button>
              </div>
            </Card>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <CameraCapture
        open={cameraOpen}
        onClose={closeCamera}
        onCapture={(blob) => void scanner.selectFile(blob, 'camera')}
        onError={onCameraError}
      />

      {phase === 'select' ? (
        <p className="mt-6 text-center text-xs text-ink-subtle">
          Results are AI estimates, not diagnoses. <Link to="/settings#privacy" className="underline">How your data is handled</Link>
        </p>
      ) : null}

      <ConfirmDialog
        open={consentDialogOpen}
        title="Cloud AI Analysis & Privacy Disclosure"
        description="When you request an AI scan, your photo and optional note are sent securely to Google Gemini via your configured backend."
        details={
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-muted">
            <li><strong>Local-first journal:</strong> Your plants, observations, photos, and care streaks stay stored safely on this device.</li>
            <li><strong>On-demand transmission:</strong> Saving photos locally never uploads them. A photo is only transmitted when you explicitly tap &ldquo;Analyse with Gemini AI&rdquo;.</li>
            <li><strong>Google Gemini processing:</strong> Cloud analysis is performed via Google Gemini API subject to Google&rsquo;s API terms.</li>
            <li><strong>Connection required:</strong> Cloud scans require internet. When offline, you can still save photos to your journal and scan later.</li>
          </ul>
        }
        confirmLabel="I understand & proceed"
        destructive={false}
        onCancel={() => setConsentDialogOpen(false)}
        onConfirm={onConfirmConsent}
      />
    </div>
  );
}

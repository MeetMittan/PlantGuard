import { useCallback, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'motion/react';
import { Camera, CheckCircle2, CloudOff, History, ImagePlus, Lightbulb, Loader2, RefreshCcw, Save, ScanLine, Square, Wifi, X } from 'lucide-react';
import { useModelState } from '@/ai/model-manager/useModelManager';
import { listPlants } from '@/db/repositories/plants';
import { PageHeader } from '@/components/layout/PageFallback';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
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
  const previewUrl = useObjectUrl(scanner.image?.image);
  const { setError } = scanner;

  const onCameraError = useCallback((error: CameraError) => setError({ code: 'INVALID_IMAGE', message: error.message }), [setError]);
  const closeCamera = useCallback(() => setCameraOpen(false), []);

  const modelReady = model.state === 'ready' || model.state === 'running';
  const selectedPlant = plants?.find((plant) => plant.id === scanner.draft.plantId);
  const { phase } = scanner;
  const qualityProblem = scanner.quality && scanner.quality.verdict !== 'suitable' && scanner.quality.verdict !== 'unknown';

  return (
    <div>
      <PageHeader
        title={selectedPlant ? `Scan ${selectedPlant.name}` : 'Scan a plant'}
        description="Photograph a single leaf in good light. Analysis runs entirely on this device, online or offline."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs" aria-live="polite">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-ink-muted">
          {online ? <Wifi className="size-3.5" aria-hidden /> : <CloudOff className="size-3.5" aria-hidden />}
          {online ? 'Online' : 'Offline'}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-ink-muted">
          {modelReady ? <CheckCircle2 className="size-3.5 text-forest" aria-hidden /> : <Loader2 className="size-3.5" aria-hidden />}
          {modelReady ? (online ? 'AI ready' : 'AI ready — works offline') : 'AI not ready'}
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
          <button type="button" onClick={() => scanner.setError(null)} className="font-medium underline">
            Dismiss
          </button>
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
                    <Field label="Context for the AI (optional)" hint="What you noticed and when. Only the on-device model sees it.">
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
                      <Button size="lg" className="w-full" icon={<ScanLine className="size-5" aria-hidden />} onClick={() => void scanner.analyze()}>
                        {qualityProblem ? 'Analyse anyway' : 'Analyse on this device'}
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <ModelReadinessCard compact />
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
                        <p className="font-semibold">Analysing on your device…</p>
                        <p className="text-sm text-ink-muted">
                          {model.analysisStep
                            ? `Step ${model.analysisStep.index + 1} of ${model.analysisStep.total}: ${model.analysisStep.label}`
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
                      Your photo stays on this device. This can take from a few seconds to a few minutes on phones. Leaving this screen may interrupt the analysis.
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
    </div>
  );
}

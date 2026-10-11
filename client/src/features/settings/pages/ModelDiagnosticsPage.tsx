import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, CheckCircle2, FlaskConical, ImagePlus, Play, XCircle } from 'lucide-react';
import { config } from '@/app/config';
import { modelManager, useModelState } from '@/ai/model-manager/useModelManager';
import type { InferenceResult } from '@/ai/contracts/types';
import { ModelRuntimeError } from '@/ai/utils/errors';
import { formatAnswers } from '@/ai/utils/parse-answers';
import { PageHeader } from '@/components/layout/PageFallback';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { buildAssessment } from '@/features/diagnosis/services/assessment-service';
import { AssessmentStatusBadge } from '@/features/diagnosis/components/AssessmentStatusBadge';
import type { PlantAssessment } from '@/features/diagnosis/schemas/assessment';
import { prepareImage } from '@/services/image-processing/image-processing';
import { formatDateTime } from '@/lib/format';
import { errorMessage } from '@/lib/utils';
import { ModelReadinessCard } from '../components/ModelReadinessCard';

interface RunRecord {
  at: string;
  online: boolean;
  source: string;
  inference: InferenceResult | null;
  assessment: PlantAssessment | null;
  error: string | null;
  wallMs: number;
}

/**
 * Model verification page (Settings → AI model → Diagnostics). Runs the REAL
 * provider on a sample or chosen photo and shows raw answers, timing, runtime
 * backend and errors, so anyone can check on their own device — including with
 * the network switched off — that local inference actually works.
 */
export default function ModelDiagnosticsPage() {
  const model = useModelState();
  const online = useOnlineStatus();
  const fileInput = useRef<HTMLInputElement>(null);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [running, setRunning] = useState(false);

  const run = async (blob: Blob, source: string) => {
    setRunning(true);
    const started = performance.now();
    const record: RunRecord = { at: new Date().toISOString(), online: navigator.onLine, source, inference: null, assessment: null, error: null, wallMs: 0 };
    try {
      const prepared = await prepareImage(blob, config.ai.maxImageDimension);
      record.inference = await modelManager.analyze({ image: prepared.image, context: '' });
      record.assessment = buildAssessment({ inference: record.inference, quality: prepared.quality });
    } catch (error) {
      record.error = error instanceof ModelRuntimeError ? `${error.detail.code}: ${error.detail.message}` : errorMessage(error);
    } finally {
      record.wallMs = Math.round(performance.now() - started);
      setRuns((current) => [record, ...current].slice(0, 10));
      setRunning(false);
    }
  };

  const runSample = async () => {
    try {
      const response = await fetch(`${config.basePath}samples/tomato-early-blight.jpg`);
      if (!response.ok) throw new Error(`Sample not available (${response.status}).`);
      await run(await response.blob(), 'Built-in sample (tomato leaf, early blight)');
    } catch (error) {
      setRuns((current) => [{ at: new Date().toISOString(), online: navigator.onLine, source: 'Built-in sample', inference: null, assessment: null, error: errorMessage(error), wallMs: 0 }, ...current]);
    }
  };

  const caps = model.capabilities;
  const checks: Array<[string, boolean | null]> = [
    ['Secure context (HTTPS/localhost)', caps ? caps.secureContext : null],
    ['WebAssembly available', caps ? caps.wasm : null],
    ['Cache API available', caps ? caps.cacheApi : null],
    ['WebGPU adapter available (optional)', caps ? caps.webgpu : null],
    ['All model files verified in cache', model.cached],
    ['Model initialized in this session', model.inMemory],
    ['Initialized with cached assets on this device', model.verifiedAt !== null],
  ];

  return (
    <div>
      <Link to="/settings#ai-model" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Settings
      </Link>
      <PageHeader
        title="Model diagnostics"
        description="Run the real on-device model on a test photo to check that local inference works here — then try again with your network switched off."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <ModelReadinessCard />
          <Card>
            <CardHeader title="Environment" icon={<FlaskConical className="size-5" />} />
            <CardBody className="space-y-3 text-sm">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-ink-subtle">Provider</dt>
                <dd>{model.providerKind === 'demo' ? 'Demo (simulated — not real AI)' : 'Transformers.js (ONNX Runtime Web)'}</dd>
                <dt className="text-ink-subtle">Model</dt>
                <dd className="break-all">{model.model.modelId}</dd>
                <dt className="text-ink-subtle">Revision</dt>
                <dd className="break-all">{model.model.revision}</dd>
                <dt className="text-ink-subtle">Weights</dt>
                <dd className="break-all">{JSON.stringify(model.model.dtype)}</dd>
                <dt className="text-ink-subtle">Backend</dt>
                <dd>{model.device ?? 'not chosen yet'}</dd>
                <dt className="text-ink-subtle">Network</dt>
                <dd>{online ? 'online' : 'offline'}</dd>
                <dt className="text-ink-subtle">Verified</dt>
                <dd>{model.verifiedAt ? formatDateTime(model.verifiedAt) : 'never on this device'}</dd>
                {model.lastInitError ? (
                  <>
                    <dt className="text-ink-subtle">Last init error</dt>
                    <dd className="text-clay">
                      {model.lastInitError.code}: {model.lastInitError.message}
                    </dd>
                  </>
                ) : null}
              </dl>
              <ul className="space-y-1">
                {checks.map(([label, ok]) => (
                  <li key={label} className="flex items-center gap-2">
                    {ok ? <CheckCircle2 className="size-4 text-forest" aria-hidden /> : <XCircle className="size-4 text-ink-subtle" aria-hidden />}
                    {label}: <span className="text-ink-muted">{ok === null ? 'checking' : ok ? 'yes' : 'no'}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Run a test" />
            <CardBody className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button icon={<Play className="size-4" aria-hidden />} onClick={() => void runSample()} loading={running} disabled={model.state !== 'ready'}>
                  Analyse sample photo
                </Button>
                <Button variant="secondary" icon={<ImagePlus className="size-4" aria-hidden />} onClick={() => fileInput.current?.click()} disabled={running || model.state !== 'ready'}>
                  Choose a photo
                </Button>
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void run(file, `Your photo (${file.name})`);
                }}
              />
              <p className="text-xs text-ink-subtle">
                Sample: tomato leaf with early blight — Clemson University – USDA Cooperative Extension Slide Series, Bugwood.org, CC BY 3.0 US (resized). Test photos are not saved.
              </p>
              {model.state !== 'ready' ? <p className="text-sm text-ink-muted">Download or initialize the model first.</p> : null}
            </CardBody>
          </Card>

          {runs.map((record) => (
            <Card key={record.at}>
              <CardBody className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{record.source}</p>
                  {record.assessment ? <AssessmentStatusBadge status={record.assessment.overallAssessment} /> : null}
                </div>
                <p className="text-xs text-ink-subtle">
                  {formatDateTime(record.at)} · {record.online ? 'online' : 'offline'} · total {(record.wallMs / 1000).toFixed(1)} s
                  {record.inference ? ` · model ${(record.inference.inferenceMs / 1000).toFixed(1)} s on ${record.inference.device ?? 'unknown backend'}` : ''}
                </p>
                {record.error ? <p className="text-clay">{record.error}</p> : null}
                {record.inference ? (
                  <pre className="whitespace-pre-wrap rounded-xl bg-surface-muted p-3 text-xs text-ink-muted">{formatAnswers(record.inference.answers)}</pre>
                ) : null}
                {record.assessment?.validationIssues.length ? (
                  <ul className="list-disc pl-5 text-xs text-sun">
                    {record.assessment.validationIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                ) : null}
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

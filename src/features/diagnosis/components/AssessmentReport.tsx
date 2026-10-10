import {
  AlertTriangle,
  BookOpen,
  Camera,
  ChevronDown,
  ExternalLink,
  Eye,
  Info,
  Lightbulb,
  ListChecks,
  ShieldAlert,
  Sprout,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { getReference } from '../references/library';
import { AI_DISCLAIMER, type PlantAssessment, type PossibleCause } from '../schemas/assessment';
import { symptomLabel } from '../symptoms';
import { AssessmentStatusBadge, STATUS_META } from './AssessmentStatusBadge';

function Section({ title, icon, children, id }: { title: string; icon: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section className="space-y-3" aria-labelledby={id}>
      <h3 id={id} className="flex items-center gap-2 font-sans text-sm font-semibold uppercase tracking-wide text-ink-muted">
        <span aria-hidden>{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Header: status, AI label, timestamp, quality warning, identity suggestion. */
export function AssessmentHeader({ assessment }: { assessment: PlantAssessment }) {
  const meta = STATUS_META[assessment.overallAssessment];
  const quality = assessment.photoQuality;
  const qualityWarning = quality.verdict !== 'suitable' && quality.verdict !== 'unknown';
  const id = assessment.plantIdentification;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <AssessmentStatusBadge status={assessment.overallAssessment} />
        <Badge tone="sky">AI-generated assessment</Badge>
        {assessment.status === 'partial' ? <Badge tone="sun">Partial result</Badge> : null}
      </div>
      <p className="text-sm text-ink-muted">{meta.description}</p>
      <p className="text-xs text-ink-subtle">Assessed {formatDateTime(assessment.createdAt)}</p>
      {qualityWarning ? (
        <div role="note" className="flex items-start gap-2 rounded-xl bg-sun-soft p-3 text-sm text-sun">
          <Camera className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Photo check (automatic, approximate)</p>
            <ul className="list-disc pl-4">
              {quality.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      {assessment.overallAssessment !== 'not_a_plant' ? (
        <div className="rounded-xl border border-line p-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            <Sprout className="size-4" aria-hidden /> Plant identity
          </p>
          <p className="mt-1 font-medium">
            {id.suggestedCommonName ? (
              <>
                {id.suggestedCommonName} <span className="text-xs font-normal text-ink-subtle">(model suggestion, unverified)</span>
              </>
            ) : (
              'Unknown'
            )}
          </p>
          <p className="text-xs text-ink-subtle">{id.uncertaintyNote}</p>
        </div>
      ) : null}
    </div>
  );
}

export function VisibleFindingsList({ assessment }: { assessment: PlantAssessment }) {
  if (assessment.overallAssessment === 'not_a_plant') return null;
  return (
    <Section title="What the model observed" icon={<Eye className="size-4" />}>
      {assessment.visibleFindings.length ? (
        <ul className="space-y-2">
          {assessment.visibleFindings.map((finding) => (
            <li key={finding.code} className="rounded-xl border border-line p-3">
              <p className="font-medium">{finding.label}</p>
              <p className="text-sm text-ink-muted">{finding.evidence}</p>
              {finding.caveat ? <p className="mt-1 text-xs text-ink-subtle">{finding.caveat}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">No visible signs were recorded.</p>
      )}
      <p className="text-xs text-ink-subtle">
        These are descriptions of what appears in the photo. They are not locations on the image — the model does not mark affected areas.
      </p>
    </Section>
  );
}

function ReferenceList({ ids }: { ids: string[] }) {
  const references = ids.map(getReference).filter((ref) => ref !== undefined);
  if (!references.length) {
    return <p className="text-xs text-ink-subtle">No matching reference in PlantGuard’s offline library for this explanation.</p>;
  }
  return (
    <ul className="space-y-1">
      {references.map((ref) => (
        <li key={ref.id} className="text-xs">
          <a href={ref.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-forest underline">
            {ref.title} <ExternalLink className="size-3" aria-hidden />
          </a>{' '}
          <span className="text-ink-subtle">— {ref.publisher}. General background, not confirmation of this case.</span>
        </li>
      ))}
    </ul>
  );
}

function CauseCard({ cause }: { cause: PossibleCause }) {
  return (
    <li className="space-y-2 rounded-2xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{cause.name}</p>
        <Badge tone={cause.origin === 'model-suggestion' ? 'sky' : 'neutral'}>
          {cause.origin === 'model-suggestion' ? 'Suggested by the AI model' : 'From reference library'}
        </Badge>
      </div>
      <p className="text-sm text-ink-muted">{cause.rationale}</p>
      {cause.supportingFindings.length ? (
        <p className="text-xs text-ink-subtle">Linked observations: {cause.supportingFindings.map(symptomLabel).join(', ')}</p>
      ) : null}
      <p className="flex items-start gap-1.5 text-xs text-sun">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {cause.uncertainty}
      </p>
      {cause.distinguishingChecks.length ? (
        <div>
          <p className="text-xs font-semibold text-ink-muted">Checks that can help tell causes apart</p>
          <ul className="list-disc pl-5 text-sm text-ink-muted">
            {cause.distinguishingChecks.map((check) => (
              <li key={check}>{check}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <ReferenceList ids={cause.referenceIds} />
    </li>
  );
}

export function PossibleCausesList({ assessment }: { assessment: PlantAssessment }) {
  if (assessment.overallAssessment !== 'possible_issue') return null;
  return (
    <Section title="Possible explanations" icon={<Lightbulb className="size-4" />}>
      <p className="text-sm text-ink-muted">This cannot be confirmed from a photo alone. One or more of these could explain what was observed — or none of them.</p>
      {assessment.possibleCauses.length ? (
        <ul className="space-y-3">
          {assessment.possibleCauses.map((cause) => (
            <CauseCard key={cause.id} cause={cause} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">No explanation could be suggested for these signs.</p>
      )}
    </Section>
  );
}

export function CareRecommendations({ assessment }: { assessment: PlantAssessment }) {
  const { immediate, followUp, prevention, expertHelp } = assessment.recommendations;
  const list = (items: string[]) => (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
  return (
    <Section title="What to do next" icon={<ListChecks className="size-4" />}>
      {immediate.length ? (
        <div>
          <p className="mb-1 text-sm font-semibold">Low-risk steps now</p>
          {list(immediate)}
        </div>
      ) : null}
      {followUp.length ? (
        <div>
          <p className="mb-1 text-sm font-semibold">Follow up</p>
          {list(followUp)}
        </div>
      ) : null}
      {prevention.length ? (
        <details className="group rounded-2xl border border-line p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
            Prevention
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="mt-2 text-ink-muted">{list(prevention)}</div>
        </details>
      ) : null}
      <div className="flex items-start gap-2 rounded-2xl border border-line p-4 text-sm">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-sky" aria-hidden />
        <div>
          <p className="font-semibold">When to ask an expert</p>
          <p className="text-ink-muted">{expertHelp}</p>
        </div>
      </div>
      <p className="text-xs text-ink-subtle">Guidance written by PlantGuard (not generated by the AI). It never includes chemical treatments or doses.</p>
    </Section>
  );
}

export function AssessmentLimitations({ assessment }: { assessment: PlantAssessment }) {
  return (
    <div className="space-y-3">
      {assessment.validationIssues.length ? (
        <div role="note" className="rounded-2xl bg-sun-soft p-4 text-sm text-sun">
          <p className="font-semibold">Notes about this result</p>
          <ul className="mt-1 list-disc pl-5">
            {assessment.validationIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <details className="group rounded-2xl border border-line p-4 text-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
          <span className="flex items-center gap-2">
            <BookOpen className="size-4" aria-hidden /> Limitations &amp; technical details
          </span>
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-ink-muted">
          {assessment.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-ink-subtle">
          <dt>Model</dt>
          <dd className="break-all">{assessment.modelId}</dd>
          {assessment.modelRevision ? (
            <>
              <dt>Revision</dt>
              <dd className="break-all">{assessment.modelRevision.slice(0, 12)}</dd>
            </>
          ) : null}
          <dt>Prompt</dt>
          <dd>{assessment.promptVersion}</dd>
          <dt>Schema</dt>
          <dd>v{assessment.assessmentSchemaVersion}</dd>
          <dt>Runtime</dt>
          <dd>{assessment.runtimeInfo.device === 'webgpu' ? 'GPU (WebGPU)' : assessment.runtimeInfo.device === 'wasm' ? 'CPU (WebAssembly)' : 'Unknown'}</dd>
          {assessment.inferenceDurationMs !== null ? (
            <>
              <dt>Time</dt>
              <dd>{(assessment.inferenceDurationMs / 1000).toFixed(1)} s</dd>
            </>
          ) : null}
          {assessment.photoQuality.metrics ? (
            <>
              <dt>Photo metrics</dt>
              <dd>
                brightness {assessment.photoQuality.metrics.meanBrightness}, detail {assessment.photoQuality.metrics.sharpness}
              </dd>
            </>
          ) : null}
        </dl>
        <p className="mt-3 text-xs font-semibold text-ink-muted">Model answers to PlantGuard’s fixed questions</p>
        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-surface-muted p-3 text-xs text-ink-muted">
          {assessment.modelAnswers}
        </pre>
      </details>
    </div>
  );
}

/**
 * Full assessment presentation. All model text is rendered as plain React
 * text (escaped) — never as HTML.
 */
export function AssessmentReport({ assessment, className }: { assessment: PlantAssessment; className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      <AssessmentHeader assessment={assessment} />
      <p className="flex items-start gap-2 rounded-xl border border-line bg-surface-muted/60 p-3 text-sm text-ink-muted">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        {AI_DISCLAIMER}
      </p>
      <VisibleFindingsList assessment={assessment} />
      <PossibleCausesList assessment={assessment} />
      <CareRecommendations assessment={assessment} />
      <AssessmentLimitations assessment={assessment} />
    </div>
  );
}

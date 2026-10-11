import { AlertTriangle, Camera, CheckCircle2, CircleSlash, HelpCircle, Leaf } from 'lucide-react';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import type { AssessmentStatus } from '../schemas/assessment';

export const STATUS_META: Record<AssessmentStatus, { label: string; tone: BadgeTone; icon: React.ReactNode; description: string }> = {
  possible_issue: {
    label: 'Possible issue',
    tone: 'clay',
    icon: <AlertTriangle className="size-3.5" aria-hidden />,
    description: 'The model described visible signs that may indicate a problem.',
  },
  no_obvious_symptoms: {
    label: 'No obvious symptoms',
    tone: 'forest',
    icon: <CheckCircle2 className="size-3.5" aria-hidden />,
    description: 'The model did not report visible symptoms in this photo.',
  },
  insufficient_evidence: {
    label: 'Inconclusive',
    tone: 'sun',
    icon: <HelpCircle className="size-3.5" aria-hidden />,
    description: 'There was not enough clear evidence in this photo to say more.',
  },
  image_quality_issue: {
    label: 'Photo quality issue',
    tone: 'sun',
    icon: <Camera className="size-3.5" aria-hidden />,
    description: 'The photo may be too dark, blurry or small for a useful result.',
  },
  not_a_plant: {
    label: 'No plant detected',
    tone: 'neutral',
    icon: <Leaf className="size-3.5" aria-hidden />,
    description: 'The model did not recognise a plant or leaf in this photo.',
  },
  analysis_unavailable: {
    label: 'Not analysed',
    tone: 'neutral',
    icon: <CircleSlash className="size-3.5" aria-hidden />,
    description: 'No AI analysis is available for this photo.',
  },
};

/** Status with icon + text, never colour alone. */
export function AssessmentStatusBadge({ status }: { status: AssessmentStatus }) {
  const meta = STATUS_META[status];
  return (
    <Badge tone={meta.tone} icon={meta.icon}>
      {meta.label}
    </Badge>
  );
}

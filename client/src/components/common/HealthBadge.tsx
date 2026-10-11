import { AlertTriangle, CheckCircle2, CircleDashed, HelpCircle } from 'lucide-react';
import type { HealthStatus } from '@/features/diagnosis/schemas/assessment';
import { Badge } from '@/components/ui/Badge';

const META: Record<HealthStatus, { label: string; tone: 'forest' | 'clay' | 'sun' | 'neutral'; icon: React.ReactNode }> = {
  healthy: { label: 'Looks healthy', tone: 'forest', icon: <CheckCircle2 className="size-3.5" aria-hidden /> },
  concern: { label: 'Possible problem', tone: 'clay', icon: <AlertTriangle className="size-3.5" aria-hidden /> },
  unclear: { label: 'Unclear', tone: 'sun', icon: <HelpCircle className="size-3.5" aria-hidden /> },
  unassessed: { label: 'Not analyzed', tone: 'neutral', icon: <CircleDashed className="size-3.5" aria-hidden /> },
};

export const HEALTH_LABELS: Record<HealthStatus, string> = Object.fromEntries(
  Object.entries(META).map(([key, value]) => [key, value.label]),
) as Record<HealthStatus, string>;

/** Health status with icon + text, so status is never conveyed by colour alone. */
export function HealthBadge({ status }: { status: HealthStatus }) {
  const meta = META[status];
  return (
    <Badge tone={meta.tone} icon={meta.icon}>
      {meta.label}
    </Badge>
  );
}

import type { HealthStatus } from '@/features/diagnosis/schemas/assessment';
import type { PlaceKind } from '@/db/schema';

export interface ExplorerItem {
  id: string;
  type: 'place' | 'observation';
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
  placeKind?: PlaceKind;
  status?: HealthStatus;
  notes?: string;
  /** Route to open for observations. */
  href?: string;
}

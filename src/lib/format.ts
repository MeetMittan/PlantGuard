import { config } from '@/app/config';

/** Decimal (SI) units, matching how model sizes are published on the Hugging Face Hub. */
export function formatBytes(bytes: number | undefined | null, fractionDigits = 1): string {
  if (bytes === undefined || bytes === null || !Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1000) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1000;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${value.toFixed(fractionDigits)} ${units[unit]}`;
}

const dateTimeFormatter = new Intl.DateTimeFormat(config.locale, { dateStyle: 'medium', timeStyle: 'short' });
const dateFormatter = new Intl.DateTimeFormat(config.locale, { dateStyle: 'medium' });
const weekdayFormatter = new Intl.DateTimeFormat(config.locale, { weekday: 'short' });

export function formatDateTime(value: string | number | Date): string {
  return dateTimeFormatter.format(new Date(value));
}

export function formatDate(value: string | number | Date): string {
  return dateFormatter.format(new Date(value));
}

export function formatWeekday(value: Date): string {
  return weekdayFormatter.format(value);
}

export function formatCoordinate(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

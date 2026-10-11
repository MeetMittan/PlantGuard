import { useDeferredValue, useState } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { History, LayoutGrid, List, ScanLine, Search, SearchX } from 'lucide-react';
import type { HealthStatus } from '@/features/diagnosis/schemas/assessment';
import { queryObservations, type ObservationQuery } from '@/db/repositories/observations';
import { PageHeader } from '@/components/layout/PageFallback';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, SegmentedControl, Select } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Progress';
import { EmptyState } from '@/components/feedback/EmptyState';
import { HEALTH_LABELS, HealthBadge } from '@/components/common/HealthBadge';
import { ObservationThumb } from '@/components/common/ObservationThumb';
import { formatDateTime, pluralize } from '@/lib/format';
import { symptomLabel } from '@/features/diagnosis/symptoms';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 24;

export default function HistoryPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<HealthStatus | 'all'>('all');
  const [fromDay, setFromDay] = useState('');
  const [toDay, setToDay] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [layout, setLayout] = useState<'list' | 'grid'>('list');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const deferredSearch = useDeferredValue(search);

  const query: ObservationQuery = { search: deferredSearch, status, sort, limit, ...(fromDay ? { fromDay } : {}), ...(toDay ? { toDay } : {}) };
  const page = useLiveQuery(() => queryObservations(query), [deferredSearch, status, sort, limit, fromDay, toDay]);
  const anyData = useLiveQuery(() => queryObservations({ limit: 1 }).then((result) => result.total > 0), []);
  const filtersActive = Boolean(search || status !== 'all' || fromDay || toDay);

  const resetFilters = () => {
    setSearch('');
    setStatus('all');
    setFromDay('');
    setToDay('');
    setLimit(PAGE_SIZE);
  };

  if (anyData === false) {
    return (
      <div>
        <PageHeader title="History" description="Every observation you save, stored on this device." />
        <EmptyState
          icon={<History className="size-7" />}
          title="No observations yet"
          description="Scan a leaf and save the result — it will appear here, even offline."
          action={
            <ButtonLink to="/scan" icon={<ScanLine className="size-4" aria-hidden />}>
              Scan a plant
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="History"
        description="Every observation you save, stored on this device."
        action={
          <SegmentedControl
            label="Layout"
            value={layout}
            onChange={setLayout}
            options={[
              { value: 'list', label: 'List', icon: <List className="size-4" aria-hidden /> },
              { value: 'grid', label: 'Grid', icon: <LayoutGrid className="size-4" aria-hidden /> },
            ]}
          />
        }
      />

      <Card className="mb-5 p-4">
        <form role="search" onSubmit={(event) => event.preventDefault()} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <Field label="Search">
            {(props) => (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
                <Input
                  {...props}
                  type="search"
                  placeholder="Plant, sign, condition, notes…"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setLimit(PAGE_SIZE);
                  }}
                  className="pl-9"
                />
              </div>
            )}
          </Field>
          <Field label="Condition">
            {(props) => (
              <Select {...props} value={status} onChange={(event) => setStatus(event.target.value as HealthStatus | 'all')}>
                <option value="all">All</option>
                {(Object.keys(HEALTH_LABELS) as HealthStatus[]).map((key) => (
                  <option key={key} value={key}>
                    {HEALTH_LABELS[key]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="From">
            {(props) => <Input {...props} type="date" value={fromDay} max={toDay || undefined} onChange={(e) => setFromDay(e.target.value)} />}
          </Field>
          <Field label="To">
            {(props) => <Input {...props} type="date" value={toDay} min={fromDay || undefined} onChange={(e) => setToDay(e.target.value)} />}
          </Field>
          <Field label="Sort">
            {(props) => (
              <Select {...props} value={sort} onChange={(event) => setSort(event.target.value as 'newest' | 'oldest')}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </Select>
            )}
          </Field>
        </form>
      </Card>

      {page === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : page.items.length === 0 ? (
        <EmptyState
          icon={<SearchX className="size-7" />}
          title="No matching observations"
          description="Try a different search term or clear the filters."
          action={
            filtersActive ? (
              <Button variant="secondary" onClick={resetFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-muted" aria-live="polite">
            {pluralize(page.total, 'observation')}
            {filtersActive ? ' match your filters' : ''}
          </p>
          <ul className={cn(layout === 'grid' ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4' : 'space-y-3')}>
            {page.items.map((observation) => {
              const title = observation.label || observation.plantSuggestion || 'Unnamed plant';
              const summary = observation.symptomTags.filter((code) => code !== 'uncertain').slice(0, 2).map(symptomLabel).join(', ');
              return (
                <li key={observation.id}>
                  <Link
                    to={`/history/${observation.id}`}
                    className={cn(
                      'group block overflow-hidden rounded-card border border-line bg-surface shadow-card transition-colors hover:border-line-strong',
                      layout === 'list' && 'flex items-center gap-4 p-3',
                    )}
                  >
                    <ObservationThumb
                      blob={observation.thumbnail}
                      alt=""
                      className={layout === 'grid' ? 'aspect-square w-full' : 'size-20 shrink-0 rounded-xl'}
                    />
                    <div className={cn('min-w-0 flex-1', layout === 'grid' && 'p-3')}>
                      <p className="truncate font-semibold">{title}</p>
                      <p className="text-xs text-ink-subtle">{formatDateTime(observation.createdAt)}</p>
                      {layout === 'list' && summary ? <p className="mt-0.5 truncate text-sm text-ink-muted">{summary}</p> : null}
                      <div className="mt-1.5">
                        <HealthBadge status={observation.healthStatus} />
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          {page.items.length < page.total ? (
            <div className="mt-6 flex justify-center">
              <Button variant="secondary" onClick={() => setLimit((current) => current + PAGE_SIZE)}>
                Show more ({page.total - page.items.length} remaining)
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

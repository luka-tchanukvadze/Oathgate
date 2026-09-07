'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Sparkles, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { ErrorState, StaleBanner } from '@/components/ui/error-state';
import { PaymentsTable, sortPayments, type Sort, type SortKey } from '@/components/payments/payments-table';
import { CreatePaymentDialog } from '@/components/payments/create-payment-dialog';
import { listPayments, queryKeys, searchPayments } from '@/lib/api';
import { useMode } from '@/hooks/use-mode';
import { cn } from '@/lib/utils';
import type { PaymentStatus } from '@/types';

const PAGE_SIZE = 25;
const DAY = 24 * 60 * 60 * 1000;

// Named the way a merchant thinks, not after my columns
const FILTERS: Array<{ value: PaymentStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'PAID', label: 'Succeeded' },
  { value: 'CONFIRMING', label: 'In progress' },
  { value: 'PENDING', label: 'Awaiting payment' },
  { value: 'UNDERPAID', label: 'Underpaid' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'REVERSED', label: 'Reversed' },
];

const FILTER_VALUES = FILTERS.map((f) => f.value);

const RANGES = [
  { value: 'all', label: 'All time', days: null },
  { value: '24h', label: 'Last 24 hours', days: 1 },
  { value: '7d', label: 'Last 7 days', days: 7 },
  { value: '30d', label: 'Last 30 days', days: 30 },
] as const;

const CURL = `curl -X POST https://oathgate-api.tchanu.com/api/v1/payments \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk_test_..." \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{"fiatAmount": "1050", "fiatCurrency": "GEL", "cryptoCurrency": "BTC"}'`;

function PaymentsInner() {
  const { mode } = useMode();
  const params = useSearchParams();
  // Left in the case it was typed, because the backend may read it as a
  // sentence and lowercasing it here would only make that harder
  const search = (params.get('q') ?? '').trim();
  const searching = search.length > 0;
  const statusParam = (params.get('status') ?? '').toUpperCase();

  const [creating, setCreating] = useState(false);
  // Seeded from the URL so a link like ?status=FAILED lands on a filtered view.
  // The old attention links searched ids and addresses for the word "failed",
  // which always came back empty
  const [filter, setFilter] = useState<PaymentStatus | 'ALL'>(
    FILTER_VALUES.includes(statusParam as PaymentStatus) ? (statusParam as PaymentStatus) : 'ALL',
  );
  const [range, setRange] = useState<(typeof RANGES)[number]['value']>('all');
  const [sort, setSort] = useState<Sort>({ key: 'created', direction: 'desc' });
  const [page, setPage] = useState(0);

  const payments = useQuery({
    queryKey: queryKeys.payments(mode),
    queryFn: () => listPayments(mode),
    // Anything pending or confirming moves on its own
    refetchInterval: 4000,
    enabled: !searching,
  });

  // No polling and no refetch on focus, unlike the list above. A search can
  // cost a call to a provider with a daily budget, so it runs when it is asked
  // for and not on a timer
  const results = useQuery({
    queryKey: queryKeys.search(mode, search),
    queryFn: () => searchPayments(mode, search),
    enabled: searching,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const active = searching ? results : payments;

  // The status and range controls still narrow a result set, but the text
  // match itself is the backend's job now
  //
  // The rows are picked inside the memo rather than above it, because the ??
  // fallback builds a new empty array every render and the memo would then
  // never hit
  const filtered = useMemo(() => {
    const rows = searching ? (results.data?.data ?? []) : (payments.data ?? []);
    const days = RANGES.find((r) => r.value === range)?.days ?? null;
    const cutoff = days === null ? null : Date.now() - days * DAY;

    return sortPayments(
      rows
        .filter((p) => (filter === 'ALL' ? true : p.status === filter))
        .filter((p) => (cutoff === null ? true : new Date(p.createdAt).getTime() >= cutoff)),
      sort,
    );
  }, [searching, results.data, payments.data, filter, range, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  function toggleSort(key: SortKey) {
    setPage(0);
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'created' ? 'desc' : 'asc' },
    );
  }

  // A first load that fails has nothing to fall back on, so it takes over the
  // card. A failed refetch keeps the old rows and just says they are stale
  const hasFilters = searching || filter !== 'ALL' || range !== 'all';
  const loaded = searching ? results.data !== undefined : payments.data !== undefined;
  const hardError = active.isError && !loaded;
  const staleError = active.isError && loaded;

  return (
    <>
      <PageHeader
        title="Payments"
        description="Track requested amounts and where each payment is in settlement."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-3.5" aria-hidden />
            Create payment
          </Button>
        }
      />

      {staleError && <StaleBanner onRetry={() => active.refetch()} retrying={active.isFetching} />}

      {hasFilters && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          {searching &&
            (results.data?.interpretation ? (
              // What the backend filtered on, not what the model said it did.
              // The sentence is built from the filter that actually ran, so
              // the two can never drift apart
              <span className="inline-flex items-center gap-1.5 text-ink-subtle">
                <Sparkles className="size-3.5 text-accent" aria-hidden />
                Read as <span className="text-ink">{results.data.interpretation}</span>
              </span>
            ) : (
              <span className="text-ink-subtle">
                Matching <span className="mono text-ink">{search}</span>
              </span>
            ))}

          {results.data?.truncated && (
            <span className="text-ink-subtle">
              Showing the first {results.data.data.length}. Narrow the search to see the rest
            </span>
          )}
          <Link
            href="/dashboard/payments"
            onClick={() => {
              setFilter('ALL');
              setRange('all');
              setPage(0);
            }}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-accent hover:bg-accent-soft"
          >
            <X className="size-3" aria-hidden />
            Clear all filters
          </Link>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="scrollbar-thin -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setFilter(value);
                setPage(0);
              }}
              aria-pressed={filter === value}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-2 text-xs font-medium transition-colors sm:py-1.5',
                filter === value ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <Select
          value={range}
          aria-label="Date range"
          onChange={(e) => {
            setRange(e.target.value as typeof range);
            setPage(0);
          }}
          className="sm:w-40"
        >
          {RANGES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <Card className="overflow-hidden">
        {hardError ? (
          <ErrorState
            title="Could not load payments"
            error={active.error}
            onRetry={() => active.refetch()}
            retrying={active.isFetching}
          />
        ) : (
          <PaymentsTable
            payments={visible}
            loading={active.isLoading}
            sort={sort}
            onSort={toggleSort}
            filtered={hasFilters}
            emptyAction={
              hasFilters ? undefined : <Button onClick={() => setCreating(true)}>Create a payment</Button>
            }
            emptyCode={hasFilters ? undefined : CURL}
          />
        )}

        {!hardError && filtered.length > PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5 sm:px-6">
            <p className="text-xs text-ink-subtle">
              {currentPage * PAGE_SIZE + 1} to {Math.min(filtered.length, (currentPage + 1) * PAGE_SIZE)} of{' '}
              {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={currentPage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="size-3.5" aria-hidden />
                Previous
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={currentPage >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                Next
                <ChevronRight className="size-3.5" aria-hidden />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <CreatePaymentDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

// useSearchParams needs a boundary, otherwise the whole route opts out of
// static rendering
export default function PaymentsPage() {
  return (
    <Suspense fallback={null}>
      <PaymentsInner />
    </Suspense>
  );
}

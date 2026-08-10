'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { ErrorState, StaleBanner } from '@/components/ui/error-state';
import { PaymentsTable, sortPayments, type Sort, type SortKey } from '@/components/payments/payments-table';
import { CreatePaymentDialog } from '@/components/payments/create-payment-dialog';
import { listPayments, queryKeys } from '@/lib/api';
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

const CURL = `curl -X POST https://api.oathgate.dev/v1/payments \\
  -H "Authorization: Bearer sk_test_..." \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{"amount": 1050, "currency": "GEL"}'`;

function PaymentsInner() {
  const { mode } = useMode();
  const params = useSearchParams();
  const search = (params.get('q') ?? '').trim().toLowerCase();
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
  });

  const filtered = useMemo(() => {
    const rows = payments.data ?? [];
    const days = RANGES.find((r) => r.value === range)?.days ?? null;
    const cutoff = days === null ? null : Date.now() - days * DAY;

    return sortPayments(
      rows
        .filter((p) => (filter === 'ALL' ? true : p.status === filter))
        .filter((p) => (cutoff === null ? true : new Date(p.createdAt).getTime() >= cutoff))
        .filter((p) =>
          search === ''
            ? true
            : p.id.toLowerCase().includes(search) ||
              (p.reference ?? '').toLowerCase().includes(search) ||
              p.address.toLowerCase().includes(search),
        ),
      sort,
    );
  }, [payments.data, filter, range, search, sort]);

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
  const hasFilters = Boolean(search) || filter !== 'ALL' || range !== 'all';
  const hardError = payments.isError && !payments.data;
  const staleError = payments.isError && Boolean(payments.data);

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

      {staleError && <StaleBanner onRetry={() => payments.refetch()} retrying={payments.isFetching} />}

      {(search || filter !== 'ALL' || range !== 'all') && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          {search && (
            <span className="text-ink-subtle">
              Matching <span className="mono text-ink">{search}</span>
            </span>
          )}
          <Link
            href="/dashboard/payments"
            onClick={() => {
              setFilter('ALL');
              setRange('all');
              setPage(0);
            }}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-accent hover:bg-accent-soft"
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
                'shrink-0 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:py-1',
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
            error={payments.error}
            onRetry={() => payments.refetch()}
            retrying={payments.isFetching}
          />
        ) : (
          <PaymentsTable
            payments={visible}
            loading={payments.isLoading}
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
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

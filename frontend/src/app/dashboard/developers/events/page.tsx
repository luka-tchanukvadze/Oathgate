'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { JsonBlock } from '@/components/ui/json-block';
import { extraKeys, listEvents } from '@/lib/api';
import { formatDateTime, formatRelative } from '@/lib/format/date';
import { cn, truncateMiddle } from '@/lib/utils';
import { useMode } from '@/hooks/use-mode';
import type { EventKind } from '@/types';

// This page is the answer to "does every backend concept need a screen". No.
// Idempotency, the outbox and the queue are mechanisms, not things a merchant
// shops for. They belong in one developer log, in the order they happened

const KIND_LABEL: Record<EventKind, string> = {
  api_request: 'API request',
  idempotency_replay: 'Idempotency',
  outbox: 'Outbox',
  queue_job: 'Queue',
  webhook: 'Webhook',
  notification: 'Notification',
  ledger: 'Ledger',
};

const KIND_TONE: Record<EventKind, string> = {
  api_request: 'neutral',
  idempotency_replay: 'special',
  outbox: 'info',
  queue_job: 'info',
  webhook: 'warn',
  notification: 'neutral',
  ledger: 'ok',
};

const FILTERS: Array<{ value: EventKind | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Everything' },
  { value: 'api_request', label: 'API requests' },
  { value: 'idempotency_replay', label: 'Idempotency' },
  { value: 'ledger', label: 'Ledger' },
  { value: 'outbox', label: 'Outbox' },
  { value: 'queue_job', label: 'Queue' },
  { value: 'webhook', label: 'Webhooks' },
  { value: 'notification', label: 'Notifications' },
];

export default function EventsPage() {
  const { mode } = useMode();
  const [filter, setFilter] = useState<EventKind | 'ALL'>('ALL');
  const [open, setOpen] = useState<string | null>(null);

  const events = useQuery({ queryKey: extraKeys.events(mode), queryFn: () => listEvents(mode) });

  const rows = useMemo(
    () => (events.data ?? []).filter((e) => (filter === 'ALL' ? true : e.kind === filter)),
    [events.data, filter],
  );

  return (
    <>
      <PageHeader
        title="Events"
        description="A technical timeline of the services working behind each payment."
      />


      <div className="scrollbar-thin -mx-4 mb-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              filter === value ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {events.isError && !events.data ? (
          <ErrorState error={events.error} onRetry={() => events.refetch()} retrying={events.isFetching} />
        ) : events.isLoading ? (
          <TableSkeleton rows={10} cols={4} />
        ) : rows.length === 0 ? (
          <EmptyState title="Nothing logged yet" description="Create a payment and the first request appears here." />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((event) => {
              const expanded = open === event.id;
              return (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : event.id)}
                    aria-expanded={expanded}
                    className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-surface-muted sm:px-5"
                  >
                    <span
                      className="mt-0.5 w-24 shrink-0 rounded-full px-2 py-0.5 text-center text-2xs font-semibold uppercase tracking-wide"
                      style={{
                        backgroundColor: `var(--${KIND_TONE[event.kind]}-bg)`,
                        color: `var(--${KIND_TONE[event.kind]}-fg)`,
                      }}
                    >
                      {KIND_LABEL[event.kind]}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="mono block truncate text-sm text-ink">{event.title}</span>
                      <span className="block truncate text-xs text-ink-subtle">{event.detail}</span>
                    </span>

                    <span className="hidden shrink-0 text-xs text-ink-faint sm:block">{event.service}</span>
                    <span className="w-16 shrink-0 text-right text-xs text-ink-faint">
                      {formatRelative(event.at)}
                    </span>
                  </button>

                  {expanded && (
                    <div className="space-y-3 border-t border-line bg-surface-muted px-5 py-4 sm:px-6">
                      <div className="flex flex-wrap gap-4 text-xs text-ink-subtle">
                        <span>{formatDateTime(event.at)}</span>
                        <span>service: {event.service}</span>
                        {event.paymentId && (
                          <Link href={`/dashboard/payments/${event.paymentId}`} className="text-accent hover:underline">
                            {truncateMiddle(event.paymentId, 12, 6)}
                          </Link>
                        )}
                      </div>
                      {event.meta && <JsonBlock value={event.meta} title="Details" />}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

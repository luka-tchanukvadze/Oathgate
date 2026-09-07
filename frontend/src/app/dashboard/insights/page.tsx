'use client';

import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Panel, PanelBody, PanelHeader, PanelTitle } from '@/components/ui/panel';
import { CodeBlock } from '@/components/ui/code-block';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { getInsights, listPayments, queryKeys } from '@/lib/api';
import { medianSettlementMinutes, WINDOW_DAYS, withinWindow } from '@/lib/derive/insights';
import { useMode } from '@/hooks/use-mode';

const TONE_LABEL = {
  good: 'Healthy',
  warn: 'Worth a look',
  neutral: 'Observation',
} as const;

// Counted from the merchant's own rows by plain rules.
// I had a staggered reveal here to make it feel like a model was thinking,
// which was theatre, and the kind of thing a technical reader spots and then
// discounts everything else for
//
// The model went to the search box instead. A filter it reads wrong is visible
// in the line above the results, and a number it reads wrong here would look
// exactly like a number it read right

export default function InsightsPage() {
  const { mode } = useMode();

  const payments = useQuery({ queryKey: queryKeys.payments(mode), queryFn: () => listPayments(mode) });
  const insights = useQuery({
    queryKey: queryKeys.insights(mode),
    queryFn: () => getInsights(mode),
    staleTime: 5 * 60 * 1000,
  });

  const cards = insights.data ?? [];
  // The same window the cards were counted over, from the same function, so the
  // printed summary cannot disagree with the numbers above it
  const rows = withinWindow(payments.data ?? []);

  // Everything the cards above are built from, printed so a merchant can check
  // them. Counts and timings, never an address, never a key, never a customer
  const context = {
    payments_total: rows.length,
    settled: rows.filter((p) => p.status === 'PAID').length,
    expired: rows.filter((p) => p.status === 'EXPIRED').length,
    underpaid: rows.filter((p) => p.status === 'UNDERPAID').length,
    reversed: rows.filter((p) => p.status === 'REVERSED').length,
    median_settlement_minutes: medianSettlementMinutes(rows),
    window_days: WINDOW_DAYS,
    mode: mode.toLowerCase(),
  };

  return (
    <>
      <PageHeader
        title="Insights"
        description={`Patterns in the last ${WINDOW_DAYS} days of payment activity. Read only, and it cannot change anything.`}
        action={
          <Button variant="secondary" onClick={() => insights.refetch()} loading={insights.isFetching}>
            <RefreshCw className="size-3.5" aria-hidden />
            Refresh insights
          </Button>
        }
      />

      {insights.isError && !insights.data && (
        <Panel className="mb-4">
          <ErrorState error={insights.error} onRetry={() => insights.refetch()} retrying={insights.isFetching} />
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {insights.isFetching || cards.length === 0
          ? Array.from({ length: 3 }).map((_, i) => (
              <Panel key={i}>
                <PanelBody>
                  <div className="mt-1 space-y-2">
                    <div className="h-3.5 w-2/3 animate-pulse rounded-full bg-surface-muted" />
                    <div className="h-3 w-full animate-pulse rounded-full bg-surface-muted" />
                    <div className="h-3 w-5/6 animate-pulse rounded-full bg-surface-muted" />
                    <div className="h-3 w-3/4 animate-pulse rounded-full bg-surface-muted" />
                  </div>
                </PanelBody>
              </Panel>
            ))
          : cards.map((insight) => (
              <Panel key={insight.id}>
                <PanelBody>
                  <span
                    className="text-2xs font-semibold uppercase tracking-wider"
                    style={{ color: insight.tone === 'warn' ? 'var(--warn-fg)' : 'var(--ink-faint)' }}
                  >
                    {TONE_LABEL[insight.tone]}
                  </span>
                  <h2 className="mt-2 text-sm font-semibold text-ink">{insight.headline}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{insight.body}</p>
                </PanelBody>
              </Panel>
            ))}
      </div>

      <Panel className="mt-4">
        <PanelHeader>
          <PanelTitle>Data used</PanelTitle>
          <span className="text-xs text-ink-faint">Counts and timings only</span>
        </PanelHeader>
        <PanelBody>
          <div className="rounded-well bg-surface-muted p-3.5">
            <CodeBlock code={JSON.stringify(context, null, 2)} className="text-ink-muted" />
          </div>
          <p className="mt-3 text-xs text-ink-subtle">
            Derived from {context.payments_total} payments. No API key, wallet address or customer detail is
            involved, and every number here can be checked against the tables on the other screens because
            it came from them.
          </p>
        </PanelBody>
      </Panel>
    </>
  );
}

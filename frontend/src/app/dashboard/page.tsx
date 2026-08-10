'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Stat } from '@/components/ui/stat';
import { Panel, PanelBody, PanelHeader, PanelTitle } from '@/components/ui/panel';
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton';
import { ErrorState, StaleBanner } from '@/components/ui/error-state';
import { StatusBadge } from '@/components/ui/status-badge';
import type { VolumePoint } from '@/components/charts/volume-chart';
import type { StatusSlice } from '@/components/charts/status-donut';
import { CreatePaymentDialog } from '@/components/payments/create-payment-dialog';
import { listPayments, listAccounts, queryKeys } from '@/lib/api';
import { formatFiat, formatCrypto, sumMinor } from '@/lib/format/money';
import { formatRelative } from '@/lib/format/date';
import { useMode } from '@/hooks/use-mode';
import type { Payment, PaymentStatus } from '@/types';

// Recharts is about a quarter of this page's JavaScript and nothing above the
// fold needs it, so it loads after the shell rather than blocking it. The
// skeleton keeps the layout from jumping when it arrives
const VolumeChart = dynamic(() => import('@/components/charts/volume-chart').then((m) => m.VolumeChart), {
  ssr: false,
  loading: () => <Skeleton className="h-55 w-full" />,
});

const StatusDonut = dynamic(() => import('@/components/charts/status-donut').then((m) => m.StatusDonut), {
  ssr: false,
  loading: () => <Skeleton className="h-36 w-full" />,
});

const DAY = 24 * 60 * 60 * 1000;
const WINDOW = 14;

const STATUS_LABEL: Record<PaymentStatus, string> = {
  PAID: 'Paid',
  CONFIRMING: 'Confirming',
  PENDING: 'Awaiting payment',
  UNDERPAID: 'Underpaid',
  EXPIRED: 'Expired',
  REVERSED: 'Reversed',
  FAILED: 'Failed',
};

// Daily settled volume, still in minor units. The chart is the only thing that
// ever turns these into a float, and it does it at the last possible moment
function dailyVolume(payments: Payment[]): VolumePoint[] {
  const now = Date.now();
  return Array.from({ length: WINDOW }, (_, i) => {
    const start = now - (WINDOW - i) * DAY;
    const settledThatDay = payments.filter((p) => {
      if (p.status !== 'PAID') return false;
      const at = new Date(p.createdAt).getTime();
      return at >= start && at < start + DAY;
    });
    return {
      label: new Date(start).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      minor: sumMinor(settledThatDay.map((p) => p.fiatAmount)),
    };
  });
}

export default function HomePage() {
  const { mode } = useMode();
  const [creating, setCreating] = useState(false);

  const payments = useQuery({ queryKey: queryKeys.payments(mode), queryFn: () => listPayments(mode) });
  const accounts = useQuery({ queryKey: queryKeys.accounts(mode), queryFn: () => listAccounts(mode) });

  const rows = useMemo(() => payments.data ?? [], [payments.data]);
  const loading = payments.isLoading;

  const stats = useMemo(() => {
    // One window, used by everything on this page
    const windowStart = Date.now() - WINDOW * DAY;
    const previousStart = windowStart - WINDOW * DAY;

    const inWindow = rows.filter((p) => new Date(p.createdAt).getTime() >= windowStart);
    const inPrevious = rows.filter((p) => {
      const at = new Date(p.createdAt).getTime();
      return at >= previousStart && at < windowStart;
    });

    const settled = inWindow.filter((p) => p.status === 'PAID');
    const settledPrevious = inPrevious.filter((p) => p.status === 'PAID');

    // Summed in BigInt. A dashboard total that drifts by a cent is the same bug
    // as a ledger that drifts by a cent
    const gross = sumMinor(settled.map((p) => p.fiatAmount));
    const previous = sumMinor(settledPrevious.map((p) => p.fiatAmount));

    const delta =
      BigInt(previous) === 0n ? null : Number(((BigInt(gross) - BigInt(previous)) * 100n) / BigInt(previous));

    const volume = dailyVolume(rows);

    const counts = new Map<PaymentStatus, number>();
    for (const payment of inWindow) counts.set(payment.status, (counts.get(payment.status) ?? 0) + 1);

    const slices: StatusSlice[] = [...counts.entries()]
      .map(([status, count]) => ({ status, label: STATUS_LABEL[status], count }))
      .sort((a, b) => b.count - a.count);

    return {
      gross,
      previous,
      delta,
      settledCount: settled.length,
      windowCount: inWindow.length,
      openCount: inWindow.filter((p) => p.status === 'PENDING' || p.status === 'CONFIRMING').length,
      rate: inWindow.length === 0 ? null : Math.round((settled.length / inWindow.length) * 100),
      volume,
      windowTotal: sumMinor(volume.map((point) => point.minor)),
      averagePayment:
        settled.length === 0
          ? '0'
          : (BigInt(sumMinor(settled.map((p) => p.fiatAmount))) / BigInt(settled.length)).toString(),
      needsAttention: {
        underpaid: inWindow.filter((p) => p.status === 'UNDERPAID'),
        failed: inWindow.filter((p) => p.status === 'FAILED'),
        expired: inWindow.filter((p) => p.status === 'EXPIRED'),
        reversed: inWindow.filter((p) => p.status === 'REVERSED'),
      },
      slices,
    };
  }, [rows]);

  const balance = accounts.data?.[0]?.balance ?? '0';
  const recent = rows.slice(0, 7);

  // Only states that a merchant could actually do something about. A count with
  // no action behind it is decoration
  const attention = [
    {
      label: 'Came in short',
      count: stats.needsAttention.underpaid.length,
      why: 'Confirmed, but less arrived than was quoted. Usually a wallet taking the network fee out of the amount.',
      status: 'UNDERPAID',
      bg: 'var(--bad-bg)',
      fg: 'var(--bad-fg)',
    },
    {
      label: 'Failed',
      count: stats.needsAttention.failed.length,
      why: 'Did not settle. Worth checking the event log for the reason.',
      status: 'FAILED',
      bg: 'var(--bad-bg)',
      fg: 'var(--bad-fg)',
    },
    {
      label: 'Expired without payment',
      count: stats.needsAttention.expired.length,
      why: 'The quote ran out before anything arrived. A longer window usually helps.',
      status: 'EXPIRED',
      bg: 'var(--neutral-bg)',
      fg: 'var(--neutral-fg)',
    },
    {
      label: 'Reversed by a reorg',
      count: stats.needsAttention.reversed.length,
      why: 'The chain reorganised and a confirmed payment turned out not to be real.',
      status: 'REVERSED',
      bg: 'var(--special-bg)',
      fg: 'var(--special-fg)',
    },
  ].filter((row) => row.count > 0);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">Home</h1>
          <p className="mt-0.5 text-sm text-ink-subtle">
            Demo Coffee Co, last 14 days
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-3.5" aria-hidden />
          Create payment
        </Button>
      </div>

      {payments.isError && payments.data && (
        <StaleBanner onRetry={() => payments.refetch()} retrying={payments.isFetching} />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-12">
        <Stat
          className="xl:col-span-3"
          label="Gross volume"
          value={
            <>
              {formatFiat(stats.gross, 'GEL')}
              <span className="ml-1 text-sm font-medium text-ink-faint">GEL</span>
            </>
          }
          previous={`${formatFiat(stats.previous, 'GEL')} previous 14 days`}
          delta={stats.delta}
          loading={loading}
        />
        <Stat
          className="xl:col-span-3"
          label="Balance"
          value={
            <>
              {formatCrypto(balance, 'BTC')}
              <span className="ml-1 text-sm font-medium text-ink-faint">BTC</span>
            </>
          }
          previous="All time, rebuilt from ledger entries"
          loading={accounts.isLoading}
        />
        <Stat
          className="xl:col-span-3"
          label="Payments settled"
          value={stats.settledCount}
          previous={`of ${stats.windowCount} created`}
          loading={loading}
        />
        <Stat
          className="xl:col-span-3"
          label="Settlement rate"
          value={stats.rate === null ? '—' : `${stats.rate}%`}
          previous={`${stats.openCount} still open`}
          loading={loading}
        />

        <Panel className="sm:col-span-2 xl:col-span-8">
          <PanelHeader>
            <PanelTitle>Settled volume</PanelTitle>
            <span className="text-xs text-ink-faint">Last 14 days</span>
          </PanelHeader>
          <PanelBody>
            {/* The chart needs a number above it. On a quiet fortnight the area
                is nearly flat, and a flat area with no total tells you nothing */}
            {loading ? (
              <Skeleton className="h-8 w-40" />
            ) : (
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="num text-2xl font-semibold tracking-tight text-ink">
                  {formatFiat(stats.averagePayment, 'GEL')}
                  <span className="ml-1.5 text-sm font-medium text-ink-subtle">GEL average</span>
                </p>
                <p className="text-xs text-ink-subtle">
                  across {stats.settledCount} settled payments
                </p>
              </div>
            )}

            <div className="mt-3">
              {loading ? <Skeleton className="h-55 w-full" /> : <VolumeChart data={stats.volume} currency="GEL" />}
            </div>
          </PanelBody>
        </Panel>

        <Panel className="sm:col-span-2 xl:col-span-4">
          <PanelHeader>
            <PanelTitle>Payment status</PanelTitle>
          </PanelHeader>
          <PanelBody>
            {loading ? (
              <Skeleton className="h-36 w-full" />
            ) : (
              <StatusDonut slices={stats.slices} total={stats.windowCount} />
            )}
          </PanelBody>
        </Panel>

        <Panel className="overflow-hidden sm:col-span-2 xl:col-span-8">
          <PanelHeader>
            <PanelTitle>Recent payments</PanelTitle>
            <Link
              href="/dashboard/payments"
              className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              View all
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          </PanelHeader>

          {payments.isError && !payments.data ? (
            <ErrorState
              title="Could not load payments"
              error={payments.error}
              onRetry={() => payments.refetch()}
              retrying={payments.isFetching}
            />
          ) : loading ? (
            <TableSkeleton rows={6} cols={4} />
          ) : recent.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-ink">No payments yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-ink-subtle">
                Create one and simulate a customer paying it to watch the whole flow run.
              </p>
              <Button className="mt-4" onClick={() => setCreating(true)}>
                Create your first payment
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((payment) => (
                <li key={payment.id}>
                  <Link
                    href={`/dashboard/payments/${payment.id}`}
                    className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-muted"
                  >
                    <span className="num w-24 shrink-0 text-sm font-medium text-ink">
                      {formatFiat(payment.fiatAmount, payment.fiatCurrency)}
                    </span>
                    <span className="w-16 shrink-0 text-xs text-ink-faint">{payment.fiatCurrency}</span>
                    <StatusBadge status={payment.status} />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-subtle">
                      {payment.reference ?? '—'}
                    </span>
                    <span className="mono hidden shrink-0 text-xs text-ink-faint lg:block">
                      {formatCrypto(payment.cryptoAmount, payment.cryptoCurrency)} BTC
                    </span>
                    <span className="w-14 shrink-0 text-right text-xs text-ink-faint">
                      {formatRelative(payment.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="sm:col-span-2 xl:col-span-4">
          <PanelHeader>
            <PanelTitle>Needs attention</PanelTitle>
            <Link
              href="/dashboard/payments"
              className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              Open payments
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          </PanelHeader>
          <PanelBody>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : attention.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <span
                  className="grid size-8 place-items-center rounded-full"
                  style={{ backgroundColor: 'var(--ok-bg)', color: 'var(--ok-fg)' }}
                  aria-hidden
                >
                  <Check className="size-4" />
                </span>
                <p className="text-sm text-ink">Nothing needs looking at</p>
                <p className="max-w-xs text-xs text-ink-subtle">
                  No shortfalls, no failures and no expired quotes in the last 14 days.
                </p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {attention.map((row) => (
                  <li key={row.label}>
                    <Link
                      href={`/dashboard/payments?status=${row.status}`}
                      className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-surface-muted"
                    >
                      <span
                        className="num mt-px w-7 shrink-0 rounded px-1.5 py-0.5 text-center text-2xs font-semibold"
                        style={{ backgroundColor: row.bg, color: row.fg }}
                      >
                        {row.count}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink">{row.label}</span>
                        <span className="block text-xs leading-relaxed text-ink-subtle">{row.why}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </PanelBody>
        </Panel>
      </div>

      <CreatePaymentDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

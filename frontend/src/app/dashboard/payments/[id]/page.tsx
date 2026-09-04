'use client';

import { use } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, PlayCircle, Undo2 } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge, WebhookBadge } from '@/components/ui/status-badge';
import { CopyButton } from '@/components/ui/copy-button';
import { JsonBlock } from '@/components/ui/json-block';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { LedgerTable } from '@/components/ledger/ledger-table';
import { StateMachine } from '@/components/charts/state-machine';
import { getPaymentDetail, queryKeys, reversePayment, simulatePayment } from '@/lib/api';
import { buildTimeline } from '@/lib/timeline';
import { formatCrypto, formatFiat } from '@/lib/format/money';
import { formatDateTime, formatRelative } from '@/lib/format/date';
import { cn, truncateMiddle } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { ErrorState } from '@/components/ui/error-state';
import { useMode } from '@/hooks/use-mode';

const TONE_COLOR = {
  neutral: 'var(--ink-subtle)',
  progress: 'var(--info-fg)',
  good: 'var(--ok-fg)',
  bad: 'var(--bad-fg)',
} as const;

export default function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { mode } = useMode();
  const queryClient = useQueryClient();
  const toast = useToast();

  const detail = useQuery({
    queryKey: queryKeys.paymentDetail(id),
    queryFn: () => getPaymentDetail(id),
    // A confirming payment changes underneath us, so this polls. Polling beats
    // websockets here: it is three lines, it survives a dropped connection, and
    // nothing on this screen needs sub-second latency
    refetchInterval: (query) => {
      const status = query.state.data?.payment.status;
      return status === 'PENDING' || status === 'CONFIRMING' ? 1500 : false;
    },
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: queryKeys.paymentDetail(id) });
    queryClient.invalidateQueries({ queryKey: queryKeys.payments(mode) });
    queryClient.invalidateQueries({ queryKey: queryKeys.ledger(mode) });
    queryClient.invalidateQueries({ queryKey: queryKeys.accounts(mode) });
    queryClient.invalidateQueries({ queryKey: queryKeys.webhooks(mode) });
  }

  const simulate = useMutation({
    mutationFn: () => simulatePayment(id),
    onSuccess: () => {
      invalidate();
      toast.success('Simulating the customer paying', 'Confirmations arrive over the next few seconds');
    },
    onError: (error) => toast.error('Could not simulate this payment', error.message),
  });

  const reverse = useMutation({
    mutationFn: () => reversePayment(id),
    onSuccess: () => {
      invalidate();
      toast.success('Payment reversed', 'A compensating pair was written, nothing was deleted');
    },
    onError: (error) => toast.error('Could not reverse this payment', error.message),
  });

  if (detail.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (detail.isError) {
    return (
      <Card>
        <ErrorState
          title="Could not load this payment"
          error={detail.error}
          onRetry={() => detail.refetch()}
          retrying={detail.isFetching}
        />
      </Card>
    );
  }

  if (!detail.data) {
    return (
      <Card>
        <EmptyState
          title="Payment not found"
          description="It may have been created in the other mode, or the demo data has been reset."
          action={
            <Link href="/dashboard/payments">
              <Button variant="secondary">Back to payments</Button>
            </Link>
          }
        />
      </Card>
    );
  }

  const { payment, chainTxs, ledger, webhooks } = detail.data;
  const timeline = buildTimeline(payment, chainTxs, webhooks);
  const confirmations = chainTxs.reduce((max, tx) => Math.max(max, tx.confirmations), 0);

  return (
    <>
      <Link
        href="/dashboard/payments"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-subtle hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Payments
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="mono text-2xl font-semibold tracking-tight text-ink">
              {formatFiat(payment.fiatAmount, payment.fiatCurrency)} {payment.fiatCurrency}
            </h1>
            <StatusBadge status={payment.status} />
          </div>
          <div className="mt-1.5 flex items-center gap-1">
            <span className="mono text-xs text-ink-subtle">{payment.id}</span>
            <CopyButton value={payment.id} label="" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* A link, styled as a button. A Button inside a Link is nested
              interactive content and invalid HTML */}
          <Link
            href={`/pay/${payment.id}`}
            target="_blank"
            className="shadow-card inline-flex h-11 items-center gap-1.5 rounded-md bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-muted sm:h-8 sm:px-3.5"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            Checkout page
          </Link>

          {payment.status === 'PENDING' && (
            <Button onClick={() => simulate.mutate()} loading={simulate.isPending}>
              <PlayCircle className="size-4" aria-hidden />
              Simulate customer payment
            </Button>
          )}

          {payment.status === 'PAID' && (
            <Button variant="danger" onClick={() => reverse.mutate()} loading={reverse.isPending}>
              <Undo2 className="size-4" aria-hidden />
              Reverse (simulate reorg)
            </Button>
          )}
        </div>
      </div>

      {payment.status === 'CONFIRMING' && (
        <Card className="mb-6 border-[var(--info-fg)]">
          <CardBody>
            <div className="flex flex-wrap items-center gap-3">
              <span className="size-2 animate-pulse rounded-full bg-[var(--info-fg)]" aria-hidden />
              <p className="text-sm text-ink">
                Waiting for confirmations,{' '}
                <span className="mono font-medium">{confirmations} of 3</span>
              </p>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-[var(--info-fg)] transition-all duration-500"
                style={{ width: `${Math.min(100, (confirmations / 3) * 100)}%` }}
              />
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>State</CardTitle>
              <span className="text-xs text-ink-faint">Where this payment sits in the machine</span>
            </CardHeader>
            <CardBody>
              <StateMachine current={payment.status} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardBody>
              <ol className="space-y-4">
                {timeline.map((item, index) => (
                  <li key={`${item.label}-${index}`} className="flex gap-3">
                    <span className="mt-1.5 flex flex-col items-center">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: TONE_COLOR[item.tone] }}
                        aria-hidden
                      />
                      {index < timeline.length - 1 && <span className="mt-1 w-px flex-1 bg-line" aria-hidden />}
                    </span>
                    <div className="min-w-0 flex-1 pb-1">
                      <p className="text-sm font-medium text-ink">{item.label}</p>
                      {item.detail && <p className="mt-0.5 text-xs text-ink-subtle">{item.detail}</p>}
                      <p className="mt-0.5 text-xs text-ink-subtle">
                        {formatDateTime(item.at)} · {formatRelative(item.at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Ledger entries</CardTitle>
              <span className="text-xs text-ink-subtle">Append only, never edited</span>
            </CardHeader>
            <LedgerTable entries={ledger} />
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Webhook deliveries</CardTitle>
            </CardHeader>
            {webhooks.length === 0 ? (
              <EmptyState title="No deliveries yet" description="A webhook fires when this payment settles." />
            ) : (
              <ul className="divide-y divide-line">
                {webhooks.map((delivery) => (
                  <li key={delivery.id} className="px-4 py-3.5 sm:px-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mono text-sm text-ink">{delivery.eventType}</span>
                      <WebhookBadge status={delivery.status} />
                      <span className="ml-auto text-xs text-ink-subtle">
                        {formatRelative(delivery.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-ink-subtle">
                      {delivery.attempts} of {delivery.maxAttempts} attempts
                      {delivery.lastResponseStatus
                        ? ` · last answer HTTP ${delivery.lastResponseStatus}`
                        : ' · nothing answered'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3.5 text-sm">
              <Detail label="Crypto amount">
                <span className="mono">
                  {formatCrypto(payment.cryptoAmount, payment.cryptoCurrency)} {payment.cryptoCurrency}
                </span>
              </Detail>
              <Detail label="Locked rate">
                <span className="mono">
                  1 BTC = {formatFiat(payment.quotedRate, payment.fiatCurrency)} {payment.fiatCurrency}
                </span>
              </Detail>
              <Detail label="Address">
                <span className="mono break-all text-xs">{payment.address}</span>
                <CopyButton value={payment.address} label="" className="-ml-1 mt-1" />
              </Detail>
              <Detail label="Reference">{payment.reference ?? '—'}</Detail>
              <Detail label="Expires">{formatDateTime(payment.expiresAt)}</Detail>
              <Detail label="Mode">
                <span
                  className={cn('rounded px-1.5 py-0.5 text-xs font-medium')}
                  style={{
                    backgroundColor: payment.mode === 'TEST' ? 'var(--warn-bg)' : 'var(--ok-bg)',
                    color: payment.mode === 'TEST' ? 'var(--warn-fg)' : 'var(--ok-fg)',
                  }}
                >
                  {payment.mode}
                </span>
              </Detail>
            </CardBody>
          </Card>

          {chainTxs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>On chain</CardTitle>
              </CardHeader>
              <CardBody className="space-y-4">
                {chainTxs.map((tx) => (
                  <div key={tx.id} className="space-y-1.5">
                    <p className="text-xs text-ink-subtle">Transaction</p>
                    <p className="mono break-all text-xs text-ink">{truncateMiddle(tx.txid, 18, 12)}</p>
                    <p className="text-xs text-ink-subtle">
                      {formatCrypto(tx.amount, tx.currency)} {tx.currency} · {tx.confirmations} confirmations
                    </p>
                    {/* The block hash is what makes a reorg detectable. If the
                        chain later disagrees about this block, the payment was
                        never real */}
                    <p className="mono break-all text-xs text-ink-subtle">
                      {tx.blockHash ? `block ${truncateMiddle(tx.blockHash, 12, 8)}` : 'not mined yet'}
                    </p>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          <JsonBlock value={payment} title="Payment object" />
        </div>
      </div>
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-ink-subtle">{label}</p>
      <div className="mt-0.5 text-ink">{children}</div>
    </div>
  );
}

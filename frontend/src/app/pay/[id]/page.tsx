'use client';

import { use, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Clock, PlayCircle } from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { getPaymentDetail, queryKeys, simulatePayment } from '@/lib/api';
import { formatCrypto, formatFiat } from '@/lib/format/money';
import { timeUntil } from '@/lib/format/date';

// The page a shopper sees. Not the merchant dashboard, so no navigation, no
// mode switch, and nothing on it needs an account

export default function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [, forceTick] = useState(0);

  const detail = useQuery({
    queryKey: queryKeys.paymentDetail(id),
    queryFn: () => getPaymentDetail(id),
    refetchInterval: (query) => {
      const status = query.state.data?.payment.status;
      return status === 'PENDING' || status === 'CONFIRMING' ? 1500 : false;
    },
  });

  const simulate = useMutation({
    mutationFn: () => simulatePayment(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.paymentDetail(id) }),
  });

  // Re-renders once a second purely so the countdown moves. Nothing is fetched
  useEffect(() => {
    const timer = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  if (detail.isLoading) {
    return (
      <Shell>
        <Skeleton className="h-72 w-full" />
      </Shell>
    );
  }

  if (!detail.data) {
    return (
      <Shell>
        <p className="text-center text-sm text-ink-subtle">
          This payment link is not valid, or the demo data has been reset.
        </p>
      </Shell>
    );
  }

  const { payment, chainTxs } = detail.data;
  const remaining = timeUntil(payment.expiresAt);
  const confirmations = chainTxs.reduce((max, tx) => Math.max(max, tx.confirmations), 0);
  const settled = payment.status === 'PAID';

  // BIP21, which is what a wallet expects when it scans. The amount goes in as
  // a decimal string built by shifting digits, never by dividing
  const bip21 = `bitcoin:${payment.address}?amount=${formatCrypto(payment.cryptoAmount, payment.cryptoCurrency)}`;

  return (
    <Shell>
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="border-b border-line px-5 py-4 text-center sm:px-6">
          <p className="text-xs text-ink-subtle">Demo Coffee Co</p>
          <p className="mono mt-1 text-2xl font-semibold tracking-tight text-ink">
            {formatFiat(payment.fiatAmount, payment.fiatCurrency)} {payment.fiatCurrency}
          </p>
          {payment.reference && <p className="mt-1 text-xs text-ink-subtle">{payment.reference}</p>}
        </div>

        {settled ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span
              className="grid size-14 place-items-center rounded-full"
              style={{ backgroundColor: 'var(--ok-bg)', color: 'var(--ok-fg)' }}
            >
              <Check className="size-7" aria-hidden />
            </span>
            <p className="text-base font-semibold text-ink">Payment received</p>
            <p className="max-w-xs text-sm text-ink-subtle">
              Confirmed on chain and settled to the merchant. They have already been notified.
            </p>
          </div>
        ) : (
          <div className="px-5 py-6 sm:px-6">
            <div className="flex flex-col items-center">
              {/* White plate behind the QR on purpose. Scanners cope badly with
                  inverted code */}
              <div className="rounded-xl bg-white p-3">
                <QRCodeSVG value={bip21} size={168} level="M" />
              </div>

              <p className="mt-4 text-xs text-ink-subtle">Send exactly</p>
              <p className="mono mt-1 text-lg font-semibold text-ink">
                {formatCrypto(payment.cryptoAmount, payment.cryptoCurrency)} {payment.cryptoCurrency}
              </p>
            </div>

            <div className="mt-5 rounded-well bg-surface-muted p-3.5">
              <p className="mb-1 text-xs text-ink-subtle">To this address</p>
              <code className="mono block break-all text-xs text-ink">{payment.address}</code>
              <CopyButton value={payment.address} label="Copy address" className="-ml-2 mt-1.5" />
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 text-sm">
              {payment.status === 'CONFIRMING' ? (
                <>
                  <StatusBadge status={payment.status} />
                  <span className="mono text-ink-subtle">{confirmations} of 3 confirmations</span>
                </>
              ) : remaining ? (
                <>
                  <Clock className="size-4 text-ink-subtle" aria-hidden />
                  <span className="mono text-ink-subtle">
                    Rate locked for {remaining.minutes}:{String(remaining.seconds).padStart(2, '0')}
                  </span>
                </>
              ) : (
                <StatusBadge status="EXPIRED" />
              )}
            </div>

            {payment.status === 'PENDING' && (
              <div className="mt-5 border-t border-line pt-5">
                <Button className="w-full" onClick={() => simulate.mutate()} loading={simulate.isPending}>
                  <PlayCircle className="size-4" aria-hidden />
                  Simulate paying this
                </Button>
                {/* The button is the fast path. Saying the slow path exists is
                    what stops someone assuming the whole thing is a mock */}
                <p className="mt-2 text-center text-xs leading-relaxed text-ink-subtle">
                  Stands in for a wallet so you can watch this settle now. Sending real testnet coins to
                  the address above works too, and takes a few minutes.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-ink-subtle">
        Secured by Oathgate. Bitcoin testnet, no real funds.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-muted px-4 py-10">
      <Logo className="mb-6" />
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}

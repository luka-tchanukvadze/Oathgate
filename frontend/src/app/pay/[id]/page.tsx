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
import { confirmCheckout, getCheckout, queryKeys } from '@/lib/api';
import { formatCrypto, formatFiat } from '@/lib/format/money';
import { timeUntil } from '@/lib/format/date';
import { MIN_CONFIRMATIONS } from '@/lib/constants';
import type { PaymentStatus } from '@/types';

// The page a shopper sees. Not the merchant dashboard, so no navigation, no
// mode switch, and nothing on it needs an account

// A payment that can no longer be paid gets a sentence instead of a QR code.
// Showing the address here would be inviting somebody to send coins into a
// payment that cannot settle them, and the shop is the only one who can help
const CLOSED: Partial<
  Record<PaymentStatus, { status: PaymentStatus; title: string; body: string }>
> = {
  EXPIRED: {
    status: 'EXPIRED',
    title: 'This payment has expired',
    body: 'The price was held for a short window and that window has closed. Ask the shop for a new payment link.',
  },
  UNDERPAID: {
    status: 'UNDERPAID',
    title: 'This payment came up short',
    body: 'Part of the amount arrived and the rest did not. Contact the shop before sending anything else.',
  },
  REVERSED: {
    status: 'REVERSED',
    title: 'This payment was reversed',
    body: 'It settled and was undone afterwards. Contact the shop if you were charged for it.',
  },
  FAILED: {
    status: 'FAILED',
    title: 'This payment could not be completed',
    body: 'Something went wrong while it was being processed. Contact the shop before trying again.',
  },
};

export default function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [, forceTick] = useState(0);

  // The public route, not a dashboard one. A shopper has no session, and the
  // response is narrower to match: no mode, no merchant id, no ledger
  const checkout = useQuery({
    queryKey: queryKeys.checkout(id),
    queryFn: () => getCheckout(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'PENDING' || status === 'CONFIRMING' ? 1500 : false;
    },
  });

  const simulate = useMutation({
    mutationFn: () => confirmCheckout(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.checkout(id) }),
  });

  // Re-renders once a second purely so the countdown moves. Nothing is fetched
  useEffect(() => {
    const timer = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  if (checkout.isLoading) {
    return (
      <Shell>
        <Skeleton className="h-72 w-full" />
      </Shell>
    );
  }

  if (!checkout.data) {
    return (
      <Shell>
        <p className="text-center text-sm text-ink-subtle">
          This payment link is not valid or has expired.
        </p>
      </Shell>
    );
  }

  const payment = checkout.data;
  const remaining = timeUntil(payment.expiresAt);
  const settled = payment.status === 'PAID';
  const confirming = payment.status === 'CONFIRMING';

  // CONFIRMING only says coins were seen, not that they were enough. Half an
  // amount confirms just as deeply as all of it, and telling somebody who sent
  // half that nothing else is needed is the worst sentence on this page
  const owed = BigInt(payment.cryptoAmount);
  const received = BigInt(payment.receivedAmount);
  const short = confirming && received < owed;

  // A pending payment whose clock has run out is expired to a customer even
  // though the sweep has not reached the row yet. The price it was quoted is
  // gone either way, so it should not still be asking for coins
  //
  // Each entry carries the status it should show, so the badge cannot read
  // Pending above a message saying the payment expired
  const closed =
    CLOSED[payment.status] ??
    (payment.status === 'PENDING' && !remaining ? CLOSED.EXPIRED : undefined);

  // BIP21, which is what a wallet expects when it scans. The amount goes in as
  // a decimal string built by shifting digits, never by dividing
  const bip21 = `bitcoin:${payment.address}?amount=${formatCrypto(payment.cryptoAmount, payment.cryptoCurrency)}`;

  return (
    <Shell>
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="border-b border-line px-5 py-4 text-center sm:px-6">
          <p className="text-xs text-ink-subtle">{payment.merchantName}</p>
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
              Confirmed on chain and settled to the merchant.
            </p>
          </div>
        ) : short ? (
          // The address stays, because this is the one confirming case where
          // the customer does still have something to do
          <div className="px-5 py-6 sm:px-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <span
                className="grid size-14 place-items-center rounded-full"
                style={{ backgroundColor: 'var(--warn-bg)', color: 'var(--warn-fg)' }}
              >
                <Clock className="size-7" aria-hidden />
              </span>
              <p className="text-base font-semibold text-ink">Part of this payment arrived</p>
              <p className="mono text-sm text-ink">
                {formatCrypto(received.toString(), payment.cryptoCurrency)} of{' '}
                {formatCrypto(payment.cryptoAmount, payment.cryptoCurrency)}{' '}
                {payment.cryptoCurrency}
              </p>
              <p className="max-w-xs text-sm text-ink-subtle">
                Send the remaining{' '}
                <span className="mono text-ink">
                  {formatCrypto((owed - received).toString(), payment.cryptoCurrency)}{' '}
                  {payment.cryptoCurrency}
                </span>{' '}
                to the same address to finish it.
              </p>
            </div>

            <div className="mt-5 rounded-well bg-surface-muted p-3.5">
              <p className="mb-1 text-xs text-ink-subtle">To this address</p>
              <code className="mono block break-all text-xs text-ink">{payment.address}</code>
              <CopyButton value={payment.address} label="Copy address" className="-ml-2 mt-1.5" />
            </div>
          </div>
        ) : confirming ? (
          // They have already sent the coins. Showing the address again would
          // be asking a paying customer to pay twice
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span
              className="grid size-14 place-items-center rounded-full"
              style={{ backgroundColor: 'var(--warn-bg)', color: 'var(--warn-fg)' }}
            >
              <Clock className="size-7" aria-hidden />
            </span>
            <p className="text-base font-semibold text-ink">Payment received</p>
            <p className="mono text-sm text-ink-subtle">
              {payment.confirmations} of {MIN_CONFIRMATIONS} confirmations
            </p>
            <p className="max-w-xs text-sm text-ink-subtle">
              Waiting for the network to confirm it. Nothing else is needed from you, and this page
              updates on its own.
            </p>
          </div>
        ) : closed ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <StatusBadge status={closed.status} />
            <p className="text-base font-semibold text-ink">{closed.title}</p>
            <p className="max-w-xs text-sm leading-relaxed text-ink-subtle">{closed.body}</p>
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
              <Clock className="size-4 text-ink-subtle" aria-hidden />
              <span className="mono text-ink-subtle">
                Rate locked for {remaining?.minutes}:
                {String(remaining?.seconds ?? 0).padStart(2, '0')}
              </span>
            </div>

            {payment.canSimulate && (
              <div className="mt-5 border-t border-line pt-5">
                <Button className="w-full" onClick={() => simulate.mutate()} loading={simulate.isPending}>
                  <PlayCircle className="size-4" aria-hidden />
                  Simulate a customer payment
                </Button>
                {/* The button is the fast path. Saying the slow path exists is
                    what stops someone assuming the whole thing is a mock */}
                <p className="mt-2 text-center text-xs leading-relaxed text-ink-subtle">
                  Stands in for a wallet so you can watch this settle now. Sending real signet coins to
                  the address above works too, and takes a few minutes.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-ink-subtle">
        Secured by Oathgate. Bitcoin signet, a test network where coins are worth nothing.
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

import { delay, http, MAX_PAGE, page, query, USING_MOCK } from './client';
import { mock } from '@/lib/mock/store';
import type { ChainTx, KeyMode, LedgerEntry, Payment, WebhookDelivery } from '@/types';

// Only one chain is connected, and the API still wants it named rather than
// assumed, so the choice stays visible in the request
const SETTLE_IN = 'BTC';

export interface PaymentDetail {
  payment: Payment;
  chainTxs: ChainTx[];
  ledger: LedgerEntry[];
  webhooks: WebhookDelivery[];
}

export async function listPayments(mode: KeyMode): Promise<Payment[]> {
  if (USING_MOCK) return delay(mock.payments(mode));
  return page<Payment>('/api/dashboard/payments', { mode, limit: MAX_PAGE.payments });
}

// mode travels with the id, and that is the point of it
// Without it, asking for a live payment while the dashboard is in test mode
// would answer instead of returning a 404
export async function getPaymentDetail(
  paymentId: string,
  mode: KeyMode,
): Promise<PaymentDetail | null> {
  if (USING_MOCK) {
    const payment = mock.payment(paymentId);
    if (!payment) return delay(null);
    return delay({
      payment,
      chainTxs: mock.chainTxs(paymentId),
      ledger: mock.ledgerFor(paymentId),
      webhooks: mock.webhooksFor(paymentId),
    });
  }

  return http<PaymentDetail>(
    `/api/dashboard/payments/${paymentId}${query({ mode })}`,
  );
}

export interface CreatePaymentInput {
  fiatAmount: string;
  fiatCurrency: string;
  reference: string | null;
  mode: KeyMode;
}

export async function createPayment(input: CreatePaymentInput): Promise<Payment> {
  if (USING_MOCK) return delay(mock.createPayment(input), 420);

  return http<Payment>('/api/dashboard/payments', {
    method: 'POST',
    // The API requires this and returns the first response for any repeat, so a
    // double-clicked button cannot create two payments
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({
      fiatAmount: input.fiatAmount,
      fiatCurrency: input.fiatCurrency,
      cryptoCurrency: SETTLE_IN,
      mode: input.mode,
      // Omitted rather than sent as null, because the field is optional and
      // validated as a string, so null is a 400
      ...(input.reference ? { reference: input.reference } : {}),
    }),
  });
}

// Stands in for a customer's wallet, and the API calls it confirm because that
// is what it does: it runs the same settlement the chain would have triggered
export async function simulatePayment(
  paymentId: string,
  mode: KeyMode,
): Promise<void> {
  if (USING_MOCK) {
    mock.simulatePayment(paymentId);
    return delay(undefined, 200);
  }

  await http<Payment>(
    `/api/dashboard/payments/${paymentId}/confirm${query({ mode })}`,
    { method: 'POST' },
  );
}

// The reason travels into the payment.reversed webhook, so whoever integrated
// against this finds out why the money went back without having to ask
export async function reversePayment(
  paymentId: string,
  mode: KeyMode,
  reason: string,
): Promise<void> {
  if (USING_MOCK) {
    mock.reversePayment(paymentId);
    return delay(undefined, 320);
  }

  await http<Payment>(
    `/api/dashboard/payments/${paymentId}/reverse${query({ mode })}`,
    { method: 'POST', body: JSON.stringify({ reason }) },
  );
}

import { delay, http, USING_MOCK } from './client';
import { mock } from '@/lib/mock/store';
import type { ChainTx, KeyMode, LedgerEntry, Payment, WebhookDelivery } from '@/types';

export interface PaymentDetail {
  payment: Payment;
  chainTxs: ChainTx[];
  ledger: LedgerEntry[];
  webhooks: WebhookDelivery[];
}

export async function listPayments(mode: KeyMode): Promise<Payment[]> {
  if (USING_MOCK) return delay(mock.payments(mode));
  return http<Payment[]>(`/v1/payments?mode=${mode.toLowerCase()}`);
}

export async function getPaymentDetail(paymentId: string): Promise<PaymentDetail | null> {
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
  return http<PaymentDetail>(`/v1/payments/${paymentId}`);
}

export interface CreatePaymentInput {
  fiatAmount: string;
  fiatCurrency: string;
  reference: string | null;
  mode: KeyMode;
}

export async function createPayment(input: CreatePaymentInput): Promise<Payment> {
  if (USING_MOCK) return delay(mock.createPayment(input), 420);
  return http<Payment>('/v1/payments', {
    method: 'POST',
    // The real API requires this header and returns the first response for any
    // repeat, so a double-clicked button cannot create two payments
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({
      amount: input.fiatAmount,
      currency: input.fiatCurrency,
      reference: input.reference,
    }),
  });
}

export async function simulatePayment(paymentId: string): Promise<void> {
  if (USING_MOCK) {
    mock.simulatePayment(paymentId);
    return delay(undefined, 200);
  }
  // Test mode only on the API side. There is no equivalent for a live key
  return http<void>(`/v1/payments/${paymentId}/simulate`, { method: 'POST' });
}

export async function reversePayment(paymentId: string): Promise<void> {
  if (USING_MOCK) {
    mock.reversePayment(paymentId);
    return delay(undefined, 320);
  }
  return http<void>(`/v1/payments/${paymentId}/reverse`, { method: 'POST' });
}

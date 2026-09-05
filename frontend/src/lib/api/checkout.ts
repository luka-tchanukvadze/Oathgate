import { ApiError, delay, http, USING_MOCK } from './client';
import { mock } from '@/lib/mock/store';
import type { Checkout } from '@/types';

// The only public routes in the product
//
// A shopper has no session and no key, so the payment id is the capability:
// it is a v7 uuid, unguessable, and holding it is what a payment link means
export async function getCheckout(paymentId: string): Promise<Checkout | null> {
  if (USING_MOCK) {
    const payment = mock.payment(paymentId);
    if (!payment) return delay(null);

    return delay({
      id: payment.id,
      status: payment.status,
      merchantName: mock.merchant().name,
      reference: payment.reference,
      fiatAmount: payment.fiatAmount,
      fiatCurrency: payment.fiatCurrency,
      cryptoAmount: payment.cryptoAmount,
      cryptoCurrency: payment.cryptoCurrency,
      address: payment.address,
      expiresAt: payment.expiresAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      confirmations: mock
        .chainTxs(paymentId)
        .reduce((max, tx) => Math.max(max, tx.confirmations), 0),
      canSimulate: payment.mode === 'TEST',
    });
  }

  try {
    return await http<Checkout>(`/api/checkout/${paymentId}`);
  } catch (error) {
    // Only a 404 means the link is wrong, and that is an ordinary answer here
    // Swallowing everything would tell a shopper their link is bad when the
    // truth is that my server fell over
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function confirmCheckout(paymentId: string): Promise<void> {
  if (USING_MOCK) {
    mock.simulatePayment(paymentId);
    return delay(undefined, 200);
  }

  await http<Checkout>(`/api/checkout/${paymentId}/confirm`, { method: 'POST' });
}

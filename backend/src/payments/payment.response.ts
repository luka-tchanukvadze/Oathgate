import type { Payment } from '../generated/prisma/client';

// Every amount leaves as a string. A JSON number becomes a double on the far
// side, and satoshis will outgrow what a double holds exactly
export function toPaymentResponse(payment: Payment) {
  return {
    id: payment.id,
    status: payment.status,
    mode: payment.mode,
    reference: payment.reference,
    fiatAmount: payment.fiatAmount.toFixed(0),
    fiatCurrency: payment.fiatCurrency,
    cryptoAmount: payment.cryptoAmount.toFixed(0),
    cryptoCurrency: payment.cryptoCurrency,
    quotedRate: payment.quotedRate.toString(),
    address: payment.address,
    expiresAt: payment.expiresAt.toISOString(),
    createdAt: payment.createdAt.toISOString(),
  };
}

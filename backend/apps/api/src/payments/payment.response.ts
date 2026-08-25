import { type Payment } from '@app/shared';

// Every amount leaves as a string
// A JSON number is a double on the far side, and satoshis outgrow it
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

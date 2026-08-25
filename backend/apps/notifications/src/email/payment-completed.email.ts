import type { OutgoingEmail } from './mailer.service';
import { formatMinorUnits } from './money';

// What this service believes a payment.completed carries. It is a separate type
// from anything the gateway exports on purpose: this is my reading of the
// message, and every field is optional until I have checked it
interface PaymentCompletedPayload {
  paymentId?: unknown;
  merchantEmail?: unknown;
  merchantName?: unknown;
  fiatAmount?: unknown;
  fiatCurrency?: unknown;
  fiatExponent?: unknown;
  cryptoAmount?: unknown;
  cryptoCurrency?: unknown;
}

export function paymentCompletedEmail(
  payload: unknown,
  mode: string,
): OutgoingEmail | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const p = payload as PaymentCompletedPayload;

  // No address means nothing to send to. Returning null rather than throwing,
  // because this is not a failure to retry: the event will never grow the field
  if (typeof p.merchantEmail !== 'string' || p.merchantEmail.length === 0) {
    return null;
  }

  const amount =
    typeof p.fiatAmount === 'string' &&
    typeof p.fiatCurrency === 'string' &&
    typeof p.fiatExponent === 'number'
      ? `${formatMinorUnits(p.fiatAmount, p.fiatExponent)} ${p.fiatCurrency}`
      : 'an unknown amount';

  const crypto =
    typeof p.cryptoAmount === 'string' && typeof p.cryptoCurrency === 'string'
      ? `${p.cryptoAmount} ${p.cryptoCurrency} base units`
      : 'unknown';

  const name = typeof p.merchantName === 'string' ? p.merchantName : 'there';
  const paymentId = typeof p.paymentId === 'string' ? p.paymentId : 'unknown';

  // The mode is in the subject because a test payment landing in an inbox next
  // to a real one, looking identical, is how someone panics on a Friday
  const subject =
    mode === 'LIVE'
      ? `Payment received: ${amount}`
      : `[TEST] Payment received: ${amount}`;

  return {
    to: p.merchantEmail,
    subject,
    text: [
      `Hi ${name},`,
      ``,
      `A payment of ${amount} has completed.`,
      ``,
      `Payment: ${paymentId}`,
      `Received: ${crypto}`,
      `Mode: ${mode}`,
      ``,
      `Oathgate`,
    ].join('\n'),
  };
}

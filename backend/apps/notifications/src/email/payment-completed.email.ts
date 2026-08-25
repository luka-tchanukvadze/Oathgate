import type { OutgoingEmail } from './mailer.service';
import { formatMinorUnits } from './money';

// My reading of a payment.completed, not a type the gateway exports
// Every field is unknown until I have checked it
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

  // No address means nothing to send to
  // null rather than a throw, because retrying will not add the field
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

  // Mode goes in the subject: [TEST] Payment received: 10.50 GEL
  // A test payment that looks identical to a real one is how someone panics
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

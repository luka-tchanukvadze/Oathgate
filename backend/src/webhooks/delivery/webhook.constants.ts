// The wait before each retry. A fixed list rather than a formula, so the numbers
// are readable and I can change one without changing all of them. Attempt 1 is
// immediate, so this gives a dead endpoint about 9 hours to come back
export const BACKOFF_SECONDS: number[] = [10, 60, 300, 1_800, 7_200, 21_600];

export const MAX_ATTEMPTS = BACKOFF_SECONDS.length + 1;

// 10 seconds. Generous for a slow endpoint, short enough that one bad merchant
// cannot sit on a worker slot
export const SEND_TIMEOUT_MS = 10_000;

export const SIGNATURE_HEADER = 'oathgate-signature';
export const EVENT_HEADER = 'oathgate-event';
export const DELIVERY_HEADER = 'oathgate-delivery';

// The attempt number is part of the id on purpose. Redis refuses a duplicate id,
// which is the dedupe I want between two sweeps ten seconds apart, but a genuine
// next attempt has to be a different job or it would be refused too
export function webhookJobId(deliveryId: string, attempts: number): string {
  return `${deliveryId}:${attempts}`;
}

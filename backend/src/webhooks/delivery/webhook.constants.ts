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

// The row's version, not just its id. Redis refuses a duplicate job id, which is
// exactly the dedupe I want between two sweeps ten seconds apart and while a
// worker is mid-send. Anything that genuinely moves the delivery on, a recorded
// attempt or a manual replay, changes updatedAt, so the next real try is a new job
export function webhookJobId(deliveryId: string, updatedAt: Date): string {
  return `${deliveryId}:${updatedAt.getTime()}`;
}

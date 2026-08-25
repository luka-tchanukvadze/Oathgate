// The wait before each retry
// A list, not a formula, so I can change one number and not all of them
// Attempt 1 is immediate, so an endpoint that is down gets about 9 hours
export const BACKOFF_SECONDS: number[] = [10, 60, 300, 1_800, 7_200, 21_600];

export const MAX_ATTEMPTS = BACKOFF_SECONDS.length + 1;

// 10 seconds
// Generous for a slow endpoint, and one merchant cannot hold a slot
export const SEND_TIMEOUT_MS = 10_000;

export const SIGNATURE_HEADER = 'oathgate-signature';
export const EVENT_HEADER = 'oathgate-event';
export const DELIVERY_HEADER = 'oathgate-delivery';

// The row's version, not just its id
// Redis refuses a duplicate, which dedupes two sweeps seconds apart
// A recorded attempt or a replay moves updatedAt and becomes a new job
// An underscore because BullMQ rejects a colon
// It builds its own keys as bull:<queue>:<jobId>, so a colon would split one
export function webhookJobId(deliveryId: string, updatedAt: Date): string {
  return `${deliveryId}_${updatedAt.getTime()}`;
}

import { type WebhookAttempt, type WebhookDelivery } from '@app/shared';

export function toDeliveryResponse(delivery: WebhookDelivery) {
  return {
    id: delivery.id,
    endpointId: delivery.endpointId,
    mode: delivery.mode,
    eventType: delivery.eventType,
    status: delivery.status,
    attempts: delivery.attempts,
    maxAttempts: delivery.maxAttempts,
    lastResponseStatus: delivery.lastResponseStatus,
    nextAttemptAt: delivery.nextAttemptAt?.toISOString() ?? null,
    deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
    createdAt: delivery.createdAt.toISOString(),
  };
}

export function toAttemptResponse(attempt: WebhookAttempt) {
  return {
    attempt: attempt.attempt,
    responseStatus: attempt.responseStatus,
    error: attempt.error,
    durationMs: attempt.durationMs,
    createdAt: attempt.createdAt.toISOString(),
  };
}

// Here and not in the list, because it is the one field that can be large
// It is also the exact body I signed, which is the point of this view
export function toDeliveryDetailResponse(
  delivery: WebhookDelivery & { webhookAttempts: WebhookAttempt[] },
) {
  return {
    ...toDeliveryResponse(delivery),
    payload: delivery.payload,
    attemptLog: delivery.webhookAttempts.map(toAttemptResponse),
  };
}

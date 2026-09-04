import { type WebhookAttempt, type WebhookDelivery } from '@app/shared';

// A delivery has no paymentId of its own
// It names the outbox event, and the event names the payment it came from
export interface DeliveryWithEvent extends WebhookDelivery {
  outboxEvent: { aggregateType: string; aggregateId: string };
}

export interface DeliveryDetail extends DeliveryWithEvent {
  webhookAttempts: WebhookAttempt[];
}

import { delay, http, USING_MOCK } from './client';
import { mock } from '@/lib/mock/store';
import type { KeyMode, WebhookDelivery } from '@/types';

export async function listWebhooks(mode: KeyMode): Promise<WebhookDelivery[]> {
  if (USING_MOCK) return delay(mock.webhooks(mode));
  return http<WebhookDelivery[]>(`/v1/webhooks?mode=${mode.toLowerCase()}`);
}

export async function replayWebhook(deliveryId: string): Promise<void> {
  if (USING_MOCK) {
    mock.replayWebhook(deliveryId);
    return delay(undefined, 300);
  }
  return http<void>(`/v1/webhooks/${deliveryId}/replay`, { method: 'POST' });
}

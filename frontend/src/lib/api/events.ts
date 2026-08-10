import { delay, http, USING_MOCK } from './client';
import { mock } from '@/lib/mock/store';
import type { KeyMode, SystemEvent, WebhookEndpoint } from '@/types';

export async function listEvents(mode: KeyMode): Promise<SystemEvent[]> {
  if (USING_MOCK) return delay(mock.events(mode));
  return http<SystemEvent[]>(`/v1/events?mode=${mode.toLowerCase()}`);
}

export async function getWebhookEndpoint(): Promise<WebhookEndpoint> {
  if (USING_MOCK) return delay(mock.endpoint(), 160);
  return http<WebhookEndpoint>('/v1/webhook-endpoints/default');
}

export async function updateWebhookEndpoint(url: string): Promise<WebhookEndpoint> {
  if (USING_MOCK) return delay(mock.updateEndpoint(url), 300);
  return http<WebhookEndpoint>('/v1/webhook-endpoints/default', {
    method: 'PATCH',
    body: JSON.stringify({ url }),
  });
}

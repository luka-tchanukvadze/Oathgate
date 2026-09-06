import { delay, http, page, query, USING_MOCK } from './client';
import { mock } from '@/lib/mock/store';
import { deriveEvents } from '@/lib/derive/events';
import { listLedger } from './ledger';
import { listPayments } from './payments';
import { listWebhooks } from './webhooks';
import type { KeyMode, SystemEvent, WebhookEndpoint } from '@/types';

// Three lists, then a projection. The API has no events table, because every
// line of this log is already implied by a row in one of the three
export async function listEvents(mode: KeyMode): Promise<SystemEvent[]> {
  if (USING_MOCK) return delay(mock.events(mode));

  const [payments, ledger, deliveries] = await Promise.all([
    listPayments(mode),
    listLedger(mode),
    listWebhooks(mode),
  ]);

  return deriveEvents({ payments, ledger, deliveries });
}

// A merchant has one endpoint per mode in practice, so the screen asks for the
// list and takes the first
export async function getWebhookEndpoint(mode: KeyMode): Promise<WebhookEndpoint | null> {
  if (USING_MOCK) return delay(mock.endpoint(), 160);

  // The list carries disabled ones too, because a delivery from last Tuesday
  // still points at one. The screen wants the endpoint that is live now
  const endpoints = await page<WebhookEndpoint>('/api/dashboard/webhook-endpoints', { mode });
  return endpoints.find((endpoint) => !endpoint.disabledAt) ?? null;
}

// Creating a second endpoint replaces the first, because the API has no update
// route: an endpoint's secret is generated with it and a changed url is a
// different destination that should not inherit the old signature
//
// The secret comes back on creation and never again, so it is returned here
// rather than dropped. Null means nothing was created
export async function updateWebhookEndpoint(
  url: string,
  mode: KeyMode,
): Promise<{ endpoint: WebhookEndpoint; secret: string | null }> {
  if (USING_MOCK) {
    const endpoint = mock.updateEndpoint(url);
    // A stand-in secret, so the reveal and its copy button are exercised with
    // no backend rather than only in production
    return delay({ endpoint, secret: `${endpoint.secretPrefix}Xk29fQpL7mNb` }, 300);
  }

  const existing = await getWebhookEndpoint(mode);

  // Saving the url it already has is not a change
  // The old order disabled the endpoint first, then failed to recreate it on
  // the unique constraint, so pressing save twice turned deliveries off
  if (existing && existing.url === url) {
    return { endpoint: existing, secret: null };
  }

  // Created before the old one is disabled, so a rejected url leaves the
  // working endpoint alone
  const created = await http<WebhookEndpoint & { secret: string }>(
    `/api/dashboard/webhook-endpoints${query({})}`,
    { method: 'POST', body: JSON.stringify({ url, mode }) },
  );

  if (existing) {
    await http<WebhookEndpoint>(
      `/api/dashboard/webhook-endpoints/${existing.id}`,
      { method: 'DELETE' },
    );
  }

  return { endpoint: created, secret: created.secret };
}

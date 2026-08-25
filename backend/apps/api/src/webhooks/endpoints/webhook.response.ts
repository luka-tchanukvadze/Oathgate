import { type WebhookEndpoint } from '@app/shared';

// secretCiphertext is deliberately absent
// The prefix is enough to tell two endpoints apart
export function toEndpointResponse(endpoint: WebhookEndpoint) {
  return {
    id: endpoint.id,
    mode: endpoint.mode,
    url: endpoint.url,
    secretPrefix: endpoint.secretPrefix,
    events: endpoint.events,
    disabledAt: endpoint.disabledAt?.toISOString() ?? null,
    createdAt: endpoint.createdAt.toISOString(),
  };
}

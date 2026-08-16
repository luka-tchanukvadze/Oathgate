import type { WebhookEndpoint } from '../generated/prisma/client';

// secretCiphertext is deliberately absent. It is in the row, it is never in a
// response, and the prefix is enough to tell two endpoints apart
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

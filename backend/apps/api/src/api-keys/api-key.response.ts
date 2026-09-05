import { type ApiKey } from '@app/shared';

// The plain key is never in here
// It exists once, in the create response, and nowhere else ever again
export function toApiKeyResponse(key: ApiKey) {
  return {
    id: key.id,
    keyPrefix: key.keyPrefix,
    mode: key.mode,
    name: key.name,
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    revokedAt: key.revokedAt?.toISOString() ?? null,
    createdAt: key.createdAt.toISOString(),
  };
}

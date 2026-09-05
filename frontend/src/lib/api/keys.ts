import { delay, http, page, USING_MOCK } from './client';
import { mock } from '@/lib/mock/store';
import type { ApiKey, ApiKeyWithSecret, KeyMode } from '@/types';

// Not scoped by mode. A merchant has keys for both, and the list is where you
// go to tell them apart
export async function listApiKeys(): Promise<ApiKey[]> {
  if (USING_MOCK) return delay(mock.apiKeys());
  return page<ApiKey>('/api/dashboard/api-keys', {});
}

export async function createApiKey(input: { name: string; mode: KeyMode }): Promise<ApiKeyWithSecret> {
  if (USING_MOCK) return delay(mock.createApiKey(input), 380);

  // The only moment the full key exists anywhere. It is never persisted here,
  // never logged, and never sent back by any later request
  return http<ApiKeyWithSecret>('/api/dashboard/api-keys', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// Revoking never deletes. Payments made with this key still need explaining
export async function revokeApiKey(keyId: string): Promise<void> {
  if (USING_MOCK) {
    mock.revokeApiKey(keyId);
    return delay(undefined, 240);
  }

  await http<ApiKey>(`/api/dashboard/api-keys/${keyId}/revoke`, { method: 'POST' });
}

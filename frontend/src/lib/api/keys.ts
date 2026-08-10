import { delay, http, USING_MOCK } from './client';
import { mock } from '@/lib/mock/store';
import type { ApiKey, ApiKeyWithSecret, KeyMode } from '@/types';

export async function listApiKeys(): Promise<ApiKey[]> {
  if (USING_MOCK) return delay(mock.apiKeys());
  return http<ApiKey[]>('/v1/api-keys');
}

export async function createApiKey(input: { name: string; mode: KeyMode }): Promise<ApiKeyWithSecret> {
  if (USING_MOCK) return delay(mock.createApiKey(input), 380);
  // The only moment the full key exists anywhere. It is never persisted here,
  // never logged, and never sent back by any later request
  return http<ApiKeyWithSecret>('/v1/api-keys', { method: 'POST', body: JSON.stringify(input) });
}

export async function revokeApiKey(keyId: string): Promise<void> {
  if (USING_MOCK) {
    mock.revokeApiKey(keyId);
    return delay(undefined, 240);
  }
  return http<void>(`/v1/api-keys/${keyId}/revoke`, { method: 'POST' });
}

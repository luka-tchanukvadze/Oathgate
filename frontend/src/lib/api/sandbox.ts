import { delay, http, USING_MOCK } from './client';
import { startMockSession } from './auth';

export interface Sandbox {
  merchantId: string;
  expiresAt: string;
}

// The account is created and signed into by one call, so what matters here is
// the Set-Cookie that comes back rather than anything in the body
export async function createSandbox(): Promise<Sandbox> {
  if (USING_MOCK) {
    startMockSession();

    return delay(
      {
        merchantId: 'mock-merchant',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      600,
    );
  }

  return http<Sandbox>('/api/dashboard/sandbox', { method: 'POST' });
}

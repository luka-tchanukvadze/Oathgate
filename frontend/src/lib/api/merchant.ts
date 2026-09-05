import { delay, http, USING_MOCK } from './client';
import { mock } from '@/lib/mock/store';
import type { Merchant } from '@/types';

// Who you are, not which session this is. dashboard/auth/me answers the second
// question and a session row carries no name or email
export async function getMerchant(): Promise<Merchant> {
  if (USING_MOCK) return delay(mock.merchant(), 120);
  return http<Merchant>('/api/dashboard/me');
}

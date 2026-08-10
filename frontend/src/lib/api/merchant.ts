import { delay, http, USING_MOCK } from './client';
import { mock } from '@/lib/mock/store';
import type { Merchant } from '@/types';

export async function getMerchant(): Promise<Merchant> {
  if (USING_MOCK) return delay(mock.merchant(), 120);
  return http<Merchant>('/v1/me');
}

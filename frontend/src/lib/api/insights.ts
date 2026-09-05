import { delay, USING_MOCK } from './client';
import { mock } from '@/lib/mock/store';
import { deriveInsights } from '@/lib/derive/insights';
import { listPayments } from './payments';
import type { Insight, KeyMode } from '@/types';

// No endpoint. Every number here is a count over rows the payments screen
// already shows, so a controller could only ever drift away from it
export async function getInsights(mode: KeyMode): Promise<Insight[]> {
  if (USING_MOCK) return delay(mock.insights(mode), 900);
  return deriveInsights(await listPayments(mode));
}

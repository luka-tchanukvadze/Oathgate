import { delay, http, USING_MOCK } from './client';
import { mock } from '@/lib/mock/store';
import type { Insight, KeyMode } from '@/types';

// Phase 6. Reads existing data only and writes nothing back, so it can be cut
// entirely without touching anything else
export async function getInsights(mode: KeyMode): Promise<Insight[]> {
  if (USING_MOCK) return delay(mock.insights(mode), 900);
  return http<Insight[]>(`/v1/insights?mode=${mode.toLowerCase()}`);
}

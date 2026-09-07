import { delay, http, query, USING_MOCK } from './client';
import { mock } from '@/lib/mock/store';
import type { KeyMode, Payment } from '@/types';

export interface PaymentSearch {
  data: Payment[];
  // How the backend read the sentence, built from the filter it actually ran
  // Null whenever the search was a plain text match
  interpretation: string | null;
  usedAi: boolean;
  // More matched than came back. Said out loud, because a capped answer that
  // looks complete is worse than one that admits it is not
  truncated: boolean;
}

// Whether the search box can read a sentence right now
// The answer belongs to the API, not to this browser: if the provider is down
// it is down for everyone, so caching it per visitor would tell them different
// stories about the same server
export async function getAiAvailability(): Promise<{ ai: boolean }> {
  if (USING_MOCK) return delay({ ai: false }, 60);
  return http<{ ai: boolean }>('/api/dashboard/search/availability');
}

export async function searchPayments(mode: KeyMode, q: string): Promise<PaymentSearch> {
  if (USING_MOCK) {
    const term = q.trim().toLowerCase();

    const data = mock
      .payments(mode)
      .filter(
        (payment) =>
          payment.id.toLowerCase().includes(term) ||
          (payment.reference ?? '').toLowerCase().includes(term) ||
          payment.address.toLowerCase().includes(term),
      );

    return delay({ data, interpretation: null, usedAi: false, truncated: false });
  }

  return http<PaymentSearch>(`/api/dashboard/search/payments${query({ mode, q })}`);
}

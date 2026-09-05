import { delay, MAX_PAGE, page, USING_MOCK } from './client';
import { mock } from '@/lib/mock/store';
import type { Account, KeyMode, LedgerEntry } from '@/types';

export async function listLedger(mode: KeyMode): Promise<LedgerEntry[]> {
  if (USING_MOCK) return delay(mock.ledger(mode));
  return page<LedgerEntry>('/api/dashboard/ledger', { mode, limit: MAX_PAGE.ledger });
}

// Called balances on the API, because that is what an account row carries: a
// cached sum of the entries, re-derivable from them at any time
export async function listAccounts(mode: KeyMode): Promise<Account[]> {
  if (USING_MOCK) return delay(mock.accounts(mode));
  return page<Account>('/api/dashboard/balances', { mode });
}

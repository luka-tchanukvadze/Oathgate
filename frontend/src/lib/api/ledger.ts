import { delay, http, USING_MOCK } from './client';
import { mock } from '@/lib/mock/store';
import type { Account, KeyMode, LedgerEntry } from '@/types';

export async function listLedger(mode: KeyMode): Promise<LedgerEntry[]> {
  if (USING_MOCK) return delay(mock.ledger(mode));
  return http<LedgerEntry[]>(`/v1/ledger?mode=${mode.toLowerCase()}`);
}

export async function listAccounts(mode: KeyMode): Promise<Account[]> {
  if (USING_MOCK) return delay(mock.accounts(mode));
  return http<Account[]>(`/v1/accounts?mode=${mode.toLowerCase()}`);
}

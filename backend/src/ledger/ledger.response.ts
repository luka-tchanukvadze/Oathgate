import type { Account, LedgerEntry } from '../generated/prisma/client';

// toFixed(0) rather than toString, because a Decimal long enough prints in
// scientific notation and satoshi amounts get there
export function toBalanceResponse(account: Account) {
  return {
    id: account.id,
    kind: account.kind,
    currency: account.currency,
    mode: account.mode,
    balance: account.balance.toFixed(0),
    updatedAt: account.updatedAt.toISOString(),
  };
}

export function toLedgerEntryResponse(entry: LedgerEntry) {
  return {
    id: entry.id,
    transferId: entry.transferId,
    accountId: entry.accountId,
    direction: entry.direction,
    amount: entry.amount.toFixed(0),
    currency: entry.currency,
    paymentId: entry.paymentId,
    reversesId: entry.reversesId,
    createdAt: entry.createdAt.toISOString(),
  };
}

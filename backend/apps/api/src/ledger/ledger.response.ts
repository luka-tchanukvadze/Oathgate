import { type Account, type LedgerEntry } from '@app/shared';

// toFixed(0), not toString
// A long enough Decimal prints as 1e+21, and satoshis get there
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

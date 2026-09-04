import { type AccountKind, type LedgerEntry } from '@app/shared';

// An entry names an account by id, and a uuid tells a reader nothing
// The kind comes along so the dashboard can say "merchant balance"
export interface LedgerEntryWithAccount extends LedgerEntry {
  account: { kind: AccountKind };
}

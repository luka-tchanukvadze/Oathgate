import { AccountKind, EntryDirection } from '../generated/prisma/client';

// Which direction grows which account
// I own the wallet, so a debit grows it
// I owe the merchant balance, so a credit grows it
export const NORMAL_SIDE: Record<AccountKind, EntryDirection> = {
  [AccountKind.GATEWAY_WALLET]: EntryDirection.DEBIT,
  [AccountKind.MERCHANT_BALANCE]: EntryDirection.CREDIT,
  [AccountKind.FEES]: EntryDirection.CREDIT,
};

export interface TransferLeg {
  accountId: string;
  kind: AccountKind;
  direction: EntryDirection;
  amount: bigint;

  // The entry this one undoes, on a reversal
  // Unique in the database, so the same entry cannot be reversed twice
  reversesId?: string;
}

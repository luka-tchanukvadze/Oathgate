import { AccountKind, EntryDirection } from '@app/shared';

// Which direction grows each kind of account. A gateway wallet holds coins I own, so a debit grows it. A merchant balance is money I owe, so a credit
// grows it. Getting this backwards would show a shop a negative balance
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
}

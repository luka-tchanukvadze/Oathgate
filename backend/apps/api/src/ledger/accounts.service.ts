import { Injectable } from '@nestjs/common';
import { AccountKind, type KeyMode, type Prisma } from '@app/shared';

type Tx = Prisma.TransactionClient;

@Injectable()
export class AccountsService {
  // findFirst rather than findUnique, because a house account has no owner and
  // Prisma will not take null as part of a compound unique key
  async house(
    tx: Tx,
    kind: AccountKind,
    currency: string,
    mode: KeyMode,
  ): Promise<{ id: string }> {
    const account = await tx.account.findFirst({
      where: { merchantId: null, kind, currency, mode },
      select: { id: true },
    });

    if (!account) {
      throw new Error(`no ${kind} account for ${currency} in ${mode}`);
    }

    return account;
  }

  async merchantBalance(
    tx: Tx,
    merchantId: string,
    currency: string,
    mode: KeyMode,
  ): Promise<{ id: string }> {
    const account = await tx.account.findUnique({
      where: {
        merchantId_currency_mode_kind: {
          merchantId,
          currency,
          mode,
          kind: AccountKind.MERCHANT_BALANCE,
        },
      },
      select: { id: true },
    });

    if (!account) {
      throw new Error(`no balance account for ${merchantId} in ${currency}`);
    }

    return account;
  }
}

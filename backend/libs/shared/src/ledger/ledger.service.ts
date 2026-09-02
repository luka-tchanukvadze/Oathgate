import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EntryDirection, Prisma } from '../generated/prisma/client';
import { NORMAL_SIDE, type TransferLeg } from './ledger.types';

type Tx = Prisma.TransactionClient;

export interface Transfer {
  currency: string;
  legs: TransferLeg[];
  paymentId?: string;
}

// Knows nothing about payments
// Legs in, balanced entries out, so refunds and fees can reuse it
@Injectable()
export class LedgerService {
  async post(tx: Tx, transfer: Transfer): Promise<string> {
    const debits = this.sumOf(transfer.legs, EntryDirection.DEBIT);
    const credits = this.sumOf(transfer.legs, EntryDirection.CREDIT);

    // The one invariant the whole design exists to protect
    // I would rather lose a payment than write books that do not balance
    if (debits !== credits) {
      throw new Error(
        `transfer does not balance: ${debits} debit against ${credits} credit`,
      );
    }

    // Sorted, so every transfer takes its row locks in the same order
    // Two taking them in opposite orders would wait on each other for ever
    const ordered = [...transfer.legs].sort((left, right) =>
      left.accountId < right.accountId ? -1 : 1,
    );

    const transferId = randomUUID();

    for (const leg of ordered) {
      await tx.$queryRaw`
        SELECT id FROM account WHERE id = ${leg.accountId}::uuid FOR UPDATE
      `;

      await tx.ledgerEntry.create({
        data: {
          transferId,
          accountId: leg.accountId,
          direction: leg.direction,
          amount: leg.amount.toString(),
          currency: transfer.currency,
          paymentId: transfer.paymentId,
          reversesId: leg.reversesId,
        },
      });

      // Grows the account on its normal side, shrinks it otherwise
      // The balance is only ever a running total of these rows
      const signed =
        leg.direction === NORMAL_SIDE[leg.kind] ? leg.amount : -leg.amount;

      await tx.account.update({
        where: { id: leg.accountId },
        data: { balance: { increment: signed.toString() } },
      });
    }

    return transferId;
  }

  private sumOf(legs: TransferLeg[], direction: EntryDirection): bigint {
    return legs
      .filter((leg) => leg.direction === direction)
      .reduce((total, leg) => total + leg.amount, 0n);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentStatus, PrismaService } from '@app/shared';

@Injectable()
export class ExpiryService {
  private readonly logger = new Logger(ExpiryService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Nothing calls this
  // Without it a payment nobody paid sits PENDING for ever
  // Once a minute is plenty, the work is one indexed update
  @Cron(CronExpression.EVERY_MINUTE)
  async sweep(): Promise<void> {
    try {
      // One statement, with the status checked inside it
      // Select first and update after, and I overwrite a payment that settled
      // The row would say EXPIRED while the ledger says PAID
      const { count } = await this.prisma.payment.updateMany({
        where: {
          status: PaymentStatus.PENDING,
          expiresAt: { lt: new Date() },
          // Nothing seen on chain, checked here rather than trusted from the
          // status. Recording a transaction and moving the payment out of
          // PENDING are two steps, and this sweep runs on its own timer, so it
          // could land between them and expire a payment somebody had paid.
          // Settlement then refuses it and the coins sit against a dead row
          chainTxs: { none: {} },
        },
        data: { status: PaymentStatus.EXPIRED },
      });

      // PENDING means nothing arrived
      // From phase 4 a customer whose coins are on the way sits in CONFIRMING
      // This query cannot touch those, so a slow chain never costs them
      if (count > 0) {
        this.logger.log(`expired ${count} payments`);
      }
    } catch (error) {
      // Swallowed
      // A failed sweep is not urgent and the next one is a minute away
      this.logger.error(`sweep failed: ${String(error)}`);
    }
  }
}

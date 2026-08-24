import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentStatus, PrismaService } from '@app/shared';

@Injectable()
export class ExpiryService {
  private readonly logger = new Logger(ExpiryService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Nothing calls this. A payment nobody paid would otherwise sit PENDING
  // forever, and a merchant's dashboard would fill with orders that can never
  // resolve. Once a minute is plenty: the work is one indexed update, and a
  // payment marked expired 40 seconds late harms nobody
  @Cron(CronExpression.EVERY_MINUTE)
  async sweep(): Promise<void> {
    try {
      // One statement, and the status is checked inside it. The version that
      // selects first and updates afterwards can overwrite a payment that
      // settled in between, leaving a row that says EXPIRED while the ledger
      // says it was paid
      const { count } = await this.prisma.payment.updateMany({
        where: {
          status: PaymentStatus.PENDING,
          expiresAt: { lt: new Date() },
        },
        data: { status: PaymentStatus.EXPIRED },
      });

      // PENDING means nothing arrived. From phase 4 a payment with coins on the
      // way sits in CONFIRMING instead, which this query cannot touch, so a
      // customer who sent in time is never expired out from under a slow chain
      if (count > 0) {
        this.logger.log(`expired ${count} payments`);
      }
    } catch (error) {
      // Swallowed on purpose. A failed sweep is not urgent, the next one is a
      // minute away, and letting it throw would only fill the log with noise
      this.logger.error(`sweep failed: ${String(error)}`);
    }
  }
}

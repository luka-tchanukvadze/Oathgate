import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MailerService } from '../email/mailer.service';
import { paymentCompletedEmail } from '../email/payment-completed.email';
import { NotificationsPrismaService } from '../prisma/notifications-prisma.service';

const BATCH_SIZE = 50;

// Five tries rides out a mail server hiccup. Past that, retrying is not the fix
const MAX_ATTEMPTS = 5;

@Injectable()
export class EventProcessorService {
  private readonly logger = new Logger(EventProcessorService.name);

  constructor(
    private readonly prisma: NotificationsPrismaService,
    private readonly mailer: MailerService,
  ) {}

  // Not inline in the subscriber. If I die between storing and sending, the row
  // is still here with processedAt null and the next sweep finds it
  @Cron(CronExpression.EVERY_10_SECONDS)
  async process(): Promise<void> {
    try {
      const due = await this.prisma.receivedEvent.findMany({
        where: { processedAt: null, attempts: { lt: MAX_ATTEMPTS } },
        orderBy: { receivedAt: 'asc' },
        take: BATCH_SIZE,
      });

      for (const event of due) {
        await this.handle(event);
      }
    } catch (error) {
      this.logger.error(`processing sweep failed: ${String(error)}`);
    }
  }

  private async handle(event: {
    id: string;
    type: string;
    mode: string;
    payload: unknown;
  }): Promise<void> {
    try {
      const email =
        event.type === 'payment.completed'
          ? paymentCompletedEmail(event.payload, event.mode)
          : null;

      if (email) {
        await this.mailer.send(email);
      }

      // Stamped even when I did nothing with it. Leaving it null means re-reading
      // the same rows for ever
      await this.prisma.receivedEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date(), lastError: null },
      });
    } catch (error) {
      // Row stays unprocessed so the next sweep retries. I keep the message here
      // because this is where I will look, not a log from three hours ago
      await this.prisma.receivedEvent.update({
        where: { id: event.id },
        data: {
          attempts: { increment: 1 },
          lastError: String(error).slice(0, 500),
        },
      });

      this.logger.error(`could not process ${event.id}: ${String(error)}`);
    }
  }
}

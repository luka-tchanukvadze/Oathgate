import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@app/shared';

@Injectable()
export class IdempotencyExpiryService {
  private readonly logger = new Logger(IdempotencyExpiryService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Every key is written with the moment it stops meaning anything, and until
  // now nothing read that column, so the table only ever grew
  //
  // Dropping a finished key past that moment is what the window is for: it is
  // longer than any sane retry, so a caller presenting one afterwards is
  // starting a new request rather than repeating an old one
  //
  // It also releases a key still held by a create that committed and then
  // failed to store its answer. Answering 409 to that is right for as long as
  // a retry could still be arriving, and wrong for ever
  //
  // Hourly, for rows that live a day
  @Cron(CronExpression.EVERY_HOUR)
  async sweep(): Promise<void> {
    try {
      const { count } = await this.prisma.idempotencyKey.deleteMany({
        where: { expiresAt: { lte: new Date() } },
      });

      if (count > 0) {
        this.logger.log(`dropped ${count} expired idempotency keys`);
      }
    } catch (error) {
      // The next run is an hour away and picks up whatever this one missed
      this.logger.error(`idempotency sweep failed: ${String(error)}`);
    }
  }
}

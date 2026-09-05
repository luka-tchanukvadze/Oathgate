import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@app/shared';

@Injectable()
export class SandboxExpiryService {
  private readonly logger = new Logger(SandboxExpiryService.name);

  constructor(private readonly prisma: PrismaService) {}

  // A sandbox ends with its credentials revoked, never with its rows deleted
  // A ledger entry is written once and never touched again
  // That is what lets a balance be re-derived by summing the entries
  // So the rows stay, unreachable, costing a few kilobytes
  //
  // Both doors, because a visitor can mint an api key while they are in
  // Hourly, for something that lives a day
  @Cron(CronExpression.EVERY_HOUR)
  async sweep(): Promise<void> {
    try {
      const expired = await this.prisma.merchant.findMany({
        where: { isDemo: true, expiresAt: { lte: new Date() } },
        select: { id: true },
      });

      if (expired.length === 0) {
        return;
      }

      const merchantId = { in: expired.map((merchant) => merchant.id) };
      const revokedAt = new Date();

      const [sessions, keys] = await this.prisma.$transaction([
        this.prisma.merchantSession.updateMany({
          where: { merchantId, revokedAt: null },
          data: { revokedAt },
        }),
        this.prisma.apiKey.updateMany({
          where: { merchantId, revokedAt: null },
          data: { revokedAt },
        }),
      ]);

      if (sessions.count > 0 || keys.count > 0) {
        this.logger.log(
          `closed ${sessions.count} sandbox sessions and ${keys.count} keys`,
        );
      }
    } catch (error) {
      // The next run is an hour away and picks up whatever this one missed
      this.logger.error(`sandbox sweep failed: ${String(error)}`);
    }
  }
}

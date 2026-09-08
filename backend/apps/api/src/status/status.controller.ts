import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  CHAIN_SETTLEMENT,
  CHAIN_WATCHER,
  HeartbeatService,
  OUTBOX_RELAY,
} from '@app/shared';
import { SessionGuard } from '../auth/guards/session.guard';

// How quiet each job may go before I say so, and each is several missed turns
// rather than one. A single slow sweep is not news, and a deploy restarts
// everything at once, so a threshold that trips on one missed tick would cry
// wolf every time I push
const JOBS = [
  {
    name: CHAIN_WATCHER,
    label: 'Watching the chain',
    // Runs every 30 seconds
    staleAfterMs: 3 * 60_000,
    // What stops being true, said the way it affects a merchant rather than
    // the way it looks from inside
    effect: 'Payments sent on chain may not be noticed yet.',
  },
  {
    name: CHAIN_SETTLEMENT,
    label: 'Settling confirmed payments',
    staleAfterMs: 3 * 60_000,
    effect: 'Confirmed payments may not have been credited yet.',
  },
  {
    name: OUTBOX_RELAY,
    label: 'Sending webhooks',
    // Runs every 5 seconds, so it may be called late far sooner
    staleAfterMs: 60_000,
    effect: 'Your server may not have been told about recent payments.',
  },
];

// Behind the session guard. A public endpoint listing which parts of the system
// are unwell is a status page written for people who are not customers
@Controller('dashboard/status')
@UseGuards(SessionGuard)
export class StatusController {
  constructor(private readonly heartbeat: HeartbeatService) {}

  @Get()
  async status() {
    const now = Date.now();

    const jobs = await Promise.all(
      JOBS.map(async ({ name, label, staleAfterMs, effect }) => {
        const lastRunAt = await this.heartbeat.lastBeat(name);

        return {
          name,
          label,
          effect,
          // Never seen reads the same as long dead and wants the same warning
          healthy:
            lastRunAt !== null && now - lastRunAt.getTime() < staleAfterMs,
          lastRunAt: lastRunAt?.toISOString() ?? null,
        };
      }),
    );

    return { healthy: jobs.every((job) => job.healthy), jobs };
  }
}

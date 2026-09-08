import { Injectable } from '@nestjs/common';
import {
  CHAIN_SETTLEMENT,
  CHAIN_WATCHER,
  HeartbeatService,
  OUTBOX_RELAY,
  PrismaService,
} from '@app/shared';

// How quiet each job may go before I say so, and each is several missed turns
// rather than one. A single slow sweep is not news, and a deploy restarts
// everything at once, so a threshold that trips on one missed tick would cry
// wolf every time I push
const JOBS = [
  {
    name: CHAIN_WATCHER,
    label: 'Watching the chain',
    // Sweeps every 30 seconds
    staleAfterMs: 3 * 60_000,
    // Said the way it affects a merchant rather than the way it looks from
    // inside. Nobody can act on the name of a service
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
    // Every 5 seconds, so it counts as late far sooner than the others
    staleAfterMs: 60_000,
    effect: 'Your server may not have been told about recent payments.',
  },
];

export interface JobHealth {
  name: string;
  label: string;
  effect: string;
  healthy: boolean;
  lastRunAt: string | null;
}

export interface SystemHealth {
  healthy: boolean;
  database: boolean;
  jobs: JobHealth[];
}

// One definition of what healthy means, read by both the public endpoint and
// the dashboard. Two copies of a threshold is two answers to one question
@Injectable()
export class SystemHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly heartbeat: HeartbeatService,
  ) {}

  async check(): Promise<SystemHealth> {
    const now = Date.now();

    const [database, jobs] = await Promise.all([
      this.databaseAnswers(),
      Promise.all(
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
      ),
    ]);

    return {
      healthy: database && jobs.every((job) => job.healthy),
      database,
      jobs,
    };
  }

  // Cheapest question that proves the connection works rather than that the
  // pool has a socket open
  private async databaseAnswers(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return true;
    } catch {
      return false;
    }
  }
}

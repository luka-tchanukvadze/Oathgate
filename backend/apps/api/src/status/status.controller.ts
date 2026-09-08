import { Controller, Get, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/guards/session.guard';
import { AiAvailabilityService } from '../search/ai-availability.service';
import { SystemHealthService } from './system-health.service';

// Behind the session guard, but a session is one click away for anybody, so
// this is written as though it were public
//
// It answers whether, never why. Only what is currently wrong, named the way it
// affects a merchant. No internal job names, no timestamps, no list of the
// parts that are fine: a healthy system says nothing here beyond being healthy,
// so a reader cannot learn its shape by asking when it is well
@Controller('dashboard/status')
@UseGuards(SessionGuard)
export class StatusController {
  constructor(
    private readonly health: SystemHealthService,
    private readonly ai: AiAvailabilityService,
  ) {}

  @Get()
  async status() {
    const { healthy, jobs } = await this.health.check();

    return {
      healthy,
      degraded: jobs
        .filter((job) => !job.healthy)
        .map(({ label, effect }) => ({ label, effect })),
      // The same value the mark in the search box already shows every visitor,
      // so publishing it reveals nothing new. When it was last confirmed is
      // kept on the service and out of here
      search: this.ai.isAvailable(),
    };
  }
}

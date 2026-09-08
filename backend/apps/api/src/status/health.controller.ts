import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SystemHealthService } from './system-health.service';

// Public, and one word only
//
// A health endpoint that names which part is unwell is a list of where to poke,
// written for people who are not customers. This says whether the gateway is
// doing its job and nothing else. The breakdown lives behind the session guard
//
// The status code carries the answer as well as the body, because that is what
// an uptime checker reads
@Controller('health')
export class HealthController {
  constructor(private readonly health: SystemHealthService) {}

  @Get()
  async check(
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ status: 'ok' | 'degraded' }> {
    const { healthy } = await this.health.check();

    response.status(healthy ? 200 : 503);

    return { status: healthy ? 'ok' : 'degraded' };
  }
}

import { Controller, HttpCode, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  SESSION_COOKIE,
  SessionService,
  sessionCookieOptions,
} from '../auth/session.service';
import { SandboxService } from './sandbox.service';

// The login handler without the password, because there is nobody to
// authenticate: this call is what brings the account into existence
@Controller('dashboard/sandbox')
export class SandboxController {
  constructor(
    private readonly sandbox: SandboxService,
    private readonly sessions: SessionService,
  ) {}

  // Three an hour per address. Seeding writes a hundred or so rows, so this is
  // the most expensive thing an anonymous caller can ask for
  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 3, ttl: 60 * 60_000 } })
  async create(@Res({ passthrough: true }) response: Response) {
    const { merchantId, expiresAt } = await this.sandbox.create();

    const session = await this.sessions.create(merchantId);

    response.cookie(
      SESSION_COOKIE,
      session.token,
      sessionCookieOptions(session.expiresAt),
    );

    return { merchantId, expiresAt: expiresAt.toISOString() };
  }
}

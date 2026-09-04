import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { AuthenticatedSession } from './auth.types';
import { CurrentSession } from './decorators/current-session.decorator';
import { LoginDto } from './dto/login.dto';
import { SessionGuard } from './guards/session.guard';
import {
  SESSION_COOKIE,
  SessionService,
  sessionCookieOptions,
} from './session.service';

@Controller('dashboard/auth')
export class DashboardAuthController {
  constructor(private readonly sessions: SessionService) {}

  // Five a minute per address, against the sixty everything else gets
  // Argon2 makes one guess slow, this stops someone paying that in parallel
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const merchantId = await this.sessions.verifyPassword(
      dto.email,
      dto.password,
    );

    // One answer for a wrong password and for an email that was never here
    if (!merchantId) {
      throw new UnauthorizedException('invalid email or password');
    }

    const { token, expiresAt } = await this.sessions.create(merchantId);

    response.cookie(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));

    return { merchantId };
  }

  // Signing out with an expired cookie still succeeds
  // There is nothing useful to tell someone already signed out
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token: unknown = request.cookies?.[SESSION_COOKIE];

    if (typeof token === 'string') {
      await this.sessions.revoke(token);
    }

    // Same flags it was set with
    // Otherwise the browser sees a different cookie and keeps the original
    response.clearCookie(SESSION_COOKIE, sessionCookieOptions(new Date(0)));

    return { ok: true };
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentSession() session: AuthenticatedSession) {
    return session;
  }
}

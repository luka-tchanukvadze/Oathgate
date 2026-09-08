import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Only the cookie half needs this
// A browser never attaches an API key on its own, so /v1 is safe
const COOKIE_AUTH_PREFIX = '/api/dashboard';

@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowed = new Set(
    (process.env.DASHBOARD_ORIGIN ?? 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim()),
  );

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // Express matches a route whatever its capitalisation and passes the path
    // on as it was typed, so anything deciding on the path normalises it first
    const path = request.path.toLowerCase();

    if (
      SAFE_METHODS.has(request.method) ||
      !path.startsWith(COOKIE_AUTH_PREFIX)
    ) {
      return true;
    }

    const origin = request.header('origin');

    // Absent means a non-browser client, which cannot hold the cookie
    // Present and wrong means another site is driving somebody's session
    if (origin && !this.allowed.has(origin)) {
      throw new ForbiddenException('origin not allowed');
    }

    return true;
  }
}

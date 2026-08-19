import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Only the cookie-authenticated half needs this. An API key is never attached
// by a browser on its own, so /v1 cannot be driven by another site
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

    if (
      SAFE_METHODS.has(request.method) ||
      !request.path.startsWith(COOKIE_AUTH_PREFIX)
    ) {
      return true;
    }

    const origin = request.header('origin');

    // Absent means a non-browser client, and forging a request needs a browser
    // that holds the cookie. Present and wrong means another site is driving
    // somebody's session
    if (origin && !this.allowed.has(origin)) {
      throw new ForbiddenException('origin not allowed');
    }

    return true;
  }
}

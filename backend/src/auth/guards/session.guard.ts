import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SESSION_COOKIE, SessionService } from '../session.service';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token: unknown = request.cookies?.[SESSION_COOKIE];

    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException('not signed in');
    }

    const session = await this.sessions.resolve(token);

    // Expired, revoked and never-existed are one answer. A browser has nothing
    // useful to do with the difference
    if (!session) {
      throw new UnauthorizedException('not signed in');
    }

    request.session = session;

    return true;
  }
}

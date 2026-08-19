import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedSession } from '../auth.types';

export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedSession => {
    const request = context.switchToHttp().getRequest<Request>();

    if (!request.session) {
      throw new Error('CurrentSession used on a route with no SessionGuard');
    }

    return request.session;
  },
);

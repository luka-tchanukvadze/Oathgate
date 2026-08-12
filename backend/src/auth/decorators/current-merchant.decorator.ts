import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedMerchant } from '../auth.types';

// Throws rather than handing back undefined, so a controller can never quietly
// run unauthenticated because I forgot the guard on it
export const CurrentMerchant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedMerchant => {
    const request = context.switchToHttp().getRequest<Request>();

    if (!request.merchant) {
      throw new Error('CurrentMerchant used on a route with no ApiKeyGuard');
    }

    return request.merchant;
  },
);

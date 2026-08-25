import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedMerchant } from '../auth.types';

// Throws rather than handing back undefined
// A controller then cannot run unauthenticated because I forgot a guard
export const CurrentMerchant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedMerchant => {
    const request = context.switchToHttp().getRequest<Request>();

    if (!request.merchant) {
      throw new Error('CurrentMerchant used on a route with no ApiKeyGuard');
    }

    return request.merchant;
  },
);

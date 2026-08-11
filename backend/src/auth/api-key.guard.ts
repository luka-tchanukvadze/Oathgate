import { createHash } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

// Refreshing lastUsedAt on every call would double the writes on this table for
// a column nobody reads in real time
const LAST_USED_STALE_MS = 5 * 60 * 1000;

function readBearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }

  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());

  return match ? match[1] : null;
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const presented = readBearerToken(request.header('authorization'));

    if (!presented) {
      throw new UnauthorizedException('missing api key');
    }

    // Hashed, then looked up. Nothing is ever compared, so there is no string
    // comparison here to leak timing
    const keyHash = createHash('sha256').update(presented).digest('hex');

    const key = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      select: {
        id: true,
        merchantId: true,
        mode: true,
        revokedAt: true,
        lastUsedAt: true,
      },
    });

    // One message for unknown and revoked alike. Telling them apart would say
    // which guesses used to be real keys
    if (!key || key.revokedAt) {
      throw new UnauthorizedException('invalid api key');
    }

    request.merchant = {
      merchantId: key.merchantId,
      apiKeyId: key.id,
      mode: key.mode,
    };

    await this.touch(key.id, key.lastUsedAt);

    return true;
  }

  private async touch(id: string, lastUsedAt: Date | null): Promise<void> {
    const stale =
      !lastUsedAt || Date.now() - lastUsedAt.getTime() > LAST_USED_STALE_MS;

    if (!stale) {
      return;
    }

    try {
      await this.prisma.apiKey.update({
        where: { id },
        data: { lastUsedAt: new Date() },
      });
    } catch {
      // A cosmetic column is never a reason to fail somebody's payment
      this.logger.warn(`could not refresh lastUsedAt for key ${id}`);
    }
  }
}

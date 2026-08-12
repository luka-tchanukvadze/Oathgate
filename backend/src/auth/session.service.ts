import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedSession } from './auth.types';

export const SESSION_COOKIE = 'oathgate_session';

// Twelve hours, and it does not slide. One column instead of two, and logging
// in again is cheap
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

// No Domain attribute, so the cookie stays host-only on the API. Secure is off
// on localhost because the browser drops secure cookies sent over plain http
export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires,
  };
}

@Injectable()
export class SessionService {
  private dummyHash?: string;

  constructor(private readonly prisma: PrismaService) {}

  // Verified against a throwaway hash when the email is unknown, so a bad email
  // and a bad password cost the same time. Otherwise the response speed alone
  // tells someone which addresses are registered
  async verifyPassword(
    email: string,
    password: string,
  ): Promise<string | null> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });

    const hash = merchant?.passwordHash ?? (await this.decoyHash());

    try {
      const matched = await argon2.verify(hash, password);

      return matched && merchant ? merchant.id : null;
    } catch {
      return null;
    }
  }

  async create(
    merchantId: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    // 32 bytes of entropy, so there is nothing to guess and nothing to sign
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await this.prisma.merchantSession.create({
      data: { merchantId, tokenHash: sha256(token), expiresAt },
    });

    return { token, expiresAt };
  }

  async resolve(token: string): Promise<AuthenticatedSession | null> {
    const session = await this.prisma.merchantSession.findUnique({
      where: { tokenHash: sha256(token) },
      select: { id: true, merchantId: true, expiresAt: true, revokedAt: true },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      return null;
    }

    return { sessionId: session.id, merchantId: session.merchantId };
  }

  // updateMany rather than update, so signing out with a stale cookie is a
  // no-op instead of a 500
  async revoke(token: string): Promise<void> {
    await this.prisma.merchantSession.updateMany({
      where: { tokenHash: sha256(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async decoyHash(): Promise<string> {
    this.dummyHash ??= await argon2.hash(randomBytes(32).toString('hex'), {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    return this.dummyHash;
  }
}

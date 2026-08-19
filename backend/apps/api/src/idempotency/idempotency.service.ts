import {
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, PrismaService } from '@app/shared';

// 24 hours. Longer than any sane retry, short enough that the table does not
// grow forever
const RETENTION_MS = 24 * 60 * 60 * 1000;

// The row is written before the work starts, so it needs a value meaning "not
// finished". No real handler answers with 0
const IN_FLIGHT = 0;

export interface IdempotentCall<T> {
  merchantId: string;
  key: string;
  requestHash: string;
  successStatus: number;
  handler: () => Promise<T>;
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async run<T>(call: IdempotentCall<T>): Promise<T> {
    const won = await this.claim(call);

    if (!won) {
      return this.replay<T>(call);
    }

    try {
      const result = await call.handler();

      await this.prisma.idempotencyKey.update({
        where: {
          merchantId_key: { merchantId: call.merchantId, key: call.key },
        },
        data: {
          responseStatus: call.successStatus,
          responseBody: result as Prisma.InputJsonValue,
        },
      });

      return result;
    } catch (error) {
      // The claim is released, or a request that failed for some unrelated
      // reason could never be retried at all
      await this.prisma.idempotencyKey.deleteMany({
        where: {
          merchantId: call.merchantId,
          key: call.key,
          responseStatus: IN_FLIGHT,
        },
      });

      throw error;
    }
  }

  // Written before the work rather than after it. Two simultaneous requests
  // both insert, Postgres allows exactly one, and losing the insert is how the
  // other one finds out it was second
  private async claim<T>(call: IdempotentCall<T>): Promise<boolean> {
    try {
      await this.prisma.idempotencyKey.create({
        data: {
          merchantId: call.merchantId,
          key: call.key,
          requestHash: call.requestHash,
          responseStatus: IN_FLIGHT,
          responseBody: {},
          expiresAt: new Date(Date.now() + RETENTION_MS),
        },
      });

      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return false;
      }

      throw error;
    }
  }

  private async replay<T>(call: IdempotentCall<T>): Promise<T> {
    const stored = await this.prisma.idempotencyKey.findUnique({
      where: { merchantId_key: { merchantId: call.merchantId, key: call.key } },
      select: { requestHash: true, responseStatus: true, responseBody: true },
    });

    // The winner failed and released the claim in the gap between my insert
    // losing and this read
    if (!stored) {
      throw new ConflictException('idempotency key is in flight, retry');
    }

    // Answering the wrong question quietly is worse than failing. The client
    // asked to charge something else and would read my old response as a yes
    if (stored.requestHash !== call.requestHash) {
      throw new UnprocessableEntityException(
        'idempotency key was already used with a different request',
      );
    }

    if (stored.responseStatus === IN_FLIGHT) {
      throw new ConflictException('idempotency key is in flight, retry');
    }

    return stored.responseBody as unknown as T;
  }
}

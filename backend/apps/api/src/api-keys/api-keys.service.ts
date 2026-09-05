import { Injectable, NotFoundException } from '@nestjs/common';
import {
  type ApiKey,
  type KeyMode,
  newApiKey,
  PrismaService,
} from '@app/shared';

export interface CreatedApiKey {
  key: ApiKey;
  secret: string;
}

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  // Revoked keys stay in the list
  // A payment made with a key still needs explaining after the key is gone
  list(merchantId: string): Promise<ApiKey[]> {
    return this.prisma.apiKey.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    merchantId: string,
    input: { name: string; mode: KeyMode },
  ): Promise<CreatedApiKey> {
    const { key: secret, keyHash, keyPrefix } = newApiKey(input.mode);

    const key = await this.prisma.apiKey.create({
      data: {
        merchantId,
        keyHash,
        keyPrefix,
        mode: input.mode,
        name: input.name,
      },
    });

    return { key, secret };
  }

  // Never a delete, and never by id alone
  //
  // updateMany rather than update, because update matches on the primary key
  // alone and would let one merchant revoke another's key. The extra where
  // clause is the whole defence
  //
  // Revoking twice succeeds. The second call changes nothing and the key is
  // still revoked, which is the answer the caller wanted either way
  async revoke(merchantId: string, id: string): Promise<ApiKey> {
    await this.prisma.apiKey.updateMany({
      where: { id, merchantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const key = await this.prisma.apiKey.findFirst({
      where: { id, merchantId },
    });

    // Not yours and does not exist answer the same, so nobody can find out
    // which ids are real
    if (!key) {
      throw new NotFoundException('api key not found');
    }

    return key;
  }
}

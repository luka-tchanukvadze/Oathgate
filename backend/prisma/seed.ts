import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  AccountKind,
  KeyMode,
  PrismaClient,
} from '../libs/shared/src/generated/prisma/client';
import { newApiKey } from '../libs/shared/src/auth/api-key';

// Every step here has to survive a second run
// A seed that only works on an empty database is one I stop trusting

const CRYPTO = 'BTC';
const MODES = [KeyMode.TEST, KeyMode.LIVE];

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set, and the seed will not invent one`);
  }
  return value;
}

// OWASP's floor for argon2id
// The memory cost is the part that matters
// It is what makes a GPU attack expensive, not just a slow loop
function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

async function ensureAccounts(prisma: PrismaClient, merchantId: string) {
  const rows = MODES.flatMap((mode) => {
    const shared = { currency: CRYPTO, mode };

    return [
      { ...shared, merchantId: null, kind: AccountKind.GATEWAY_WALLET },
      { ...shared, merchantId: null, kind: AccountKind.FEES },
      { ...shared, merchantId, kind: AccountKind.MERCHANT_BALANCE },
    ];
  });

  // skipDuplicates compiles to ON CONFLICT DO NOTHING
  // That is what makes a second run a no-op, not a unique violation
  const { count } = await prisma.account.createMany({
    data: rows,
    skipDuplicates: true,
  });

  return count;
}

async function main() {
  const url = required('DATABASE_URL');
  const email = required('SEED_MERCHANT_EMAIL');
  const password = required('SEED_MERCHANT_PASSWORD');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });

  try {
    const passwordHash = await hashPassword(password);

    const merchant = await prisma.merchant.upsert({
      where: { email },
      create: {
        email,
        name: 'Demo Coffee',
        settlementCurrency: 'GEL',
        passwordHash,
      },
      // Only the password, so re-running undoes nothing I changed by hand
      update: { passwordHash },
    });

    const created = await ensureAccounts(prisma, merchant.id);

    console.log(`merchant  ${merchant.email} (${merchant.id})`);
    console.log(`accounts  ${created} created, ${6 - created} already there`);

    const activeTestKey = await prisma.apiKey.findFirst({
      where: {
        merchantId: merchant.id,
        mode: KeyMode.TEST,
        revokedAt: null,
      },
      select: { keyPrefix: true },
    });

    if (activeTestKey) {
      console.log(`test key  ${activeTestKey.keyPrefix} (already there)`);
    } else {
      const { key, keyHash, keyPrefix } = newApiKey(KeyMode.TEST);

      await prisma.apiKey.create({
        data: {
          merchantId: merchant.id,
          keyHash,
          keyPrefix,
          mode: KeyMode.TEST,
          name: 'Seed TEST key',
        },
      });

      console.log(`test key  ${key}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

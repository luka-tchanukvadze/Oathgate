import { Injectable } from '@nestjs/common';
import type { AuthenticatedMerchant } from '../auth/auth.types';
import { KeyMode, type Payment } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QuoteService } from '../rates/quote.service';
import { placeholderAddress } from './address';
import { CreatePaymentDto } from './dto/create-payment.dto';

// Named here rather than built from the mode, so the value reaching raw SQL can
// only ever be one of these two strings
const DERIVATION_SEQUENCE: Record<KeyMode, string> = {
  [KeyMode.TEST]: 'payment_derivation_index_test',
  [KeyMode.LIVE]: 'payment_derivation_index_live',
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: QuoteService,
  ) {}

  async create(
    merchant: AuthenticatedMerchant,
    dto: CreatePaymentDto,
  ): Promise<Payment> {
    const quote = await this.quotes.quote(
      BigInt(dto.fiatAmount),
      dto.fiatCurrency,
      dto.cryptoCurrency,
    );

    const derivationIndex = await this.nextDerivationIndex(merchant.mode);

    return this.prisma.payment.create({
      data: {
        merchantId: merchant.merchantId,
        apiKeyId: merchant.apiKeyId,
        // Copied off the key. Nothing the caller sends can change which world
        // this payment lives in
        mode: merchant.mode,
        reference: dto.reference,
        // Strings, not numbers, all the way into the Decimal columns
        fiatAmount: quote.fiatAmount.toString(),
        fiatCurrency: quote.fiatCurrency,
        cryptoAmount: quote.cryptoAmount.toString(),
        cryptoCurrency: quote.cryptoCurrency,
        quotedRate: quote.rate,
        address: placeholderAddress(merchant.mode, derivationIndex),
        derivationIndex,
        expiresAt: quote.expiresAt,
      },
    });
  }

  // Counting existing rows and adding one hands the same number to two
  // concurrent requests, and two payments sharing an index would share an
  // address. nextval cannot do that
  private async nextDerivationIndex(mode: KeyMode): Promise<number> {
    const sequence = DERIVATION_SEQUENCE[mode];

    const rows = await this.prisma.$queryRaw<{ value: bigint }[]>`
      SELECT nextval(${sequence}::regclass) AS value
    `;

    const value = rows[0]?.value;

    if (value === undefined) {
      throw new Error(`sequence ${sequence} returned nothing`);
    }

    return Number(value);
  }
}

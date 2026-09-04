import { Injectable, NotFoundException } from '@nestjs/common';
import { KeyMode, type Page, type Payment, PrismaService } from '@app/shared';
import { QuoteService } from '../rates/quote.service';
import { AddressService } from './address.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { DEFAULT_LIMIT, ListPaymentsDto } from './dto/list-payments.dto';
import type { PaymentAuthor } from './payments.types';

// Named here rather than built from the mode
// The value reaching raw SQL can then only be one of these two strings
const DERIVATION_SEQUENCE: Record<KeyMode, string> = {
  [KeyMode.TEST]: 'payment_derivation_index_test',
  [KeyMode.LIVE]: 'payment_derivation_index_live',
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: QuoteService,
    private readonly addresses: AddressService,
  ) {}

  async create(author: PaymentAuthor, dto: CreatePaymentDto): Promise<Payment> {
    const quote = await this.quotes.quote(
      BigInt(dto.fiatAmount),
      dto.fiatCurrency,
      dto.cryptoCurrency,
    );

    const derivationIndex = await this.nextDerivationIndex(author.mode);

    return this.prisma.payment.create({
      data: {
        merchantId: author.merchantId,
        apiKeyId: author.apiKeyId,
        // Frozen at creation, never joined back to the key
        // Revoking a key must not take its payments' mode with it
        mode: author.mode,
        reference: dto.reference,
        // Strings, not numbers, all the way into the Decimal columns
        fiatAmount: quote.fiatAmount.toString(),
        fiatCurrency: quote.fiatCurrency,
        cryptoAmount: quote.cryptoAmount.toString(),
        cryptoCurrency: quote.cryptoCurrency,
        quotedRate: quote.rate,
        address: this.addresses.derive(author.mode, derivationIndex),
        derivationIndex,
        expiresAt: quote.expiresAt,
      },
    });
  }

  // merchantId and mode together, always
  // Without the merchant a caller reads somebody else's payments
  // Without the mode a live dashboard shows test money
  async list(
    merchantId: string,
    mode: KeyMode,
    query: ListPaymentsDto,
  ): Promise<Page<Payment>> {
    const limit = query.limit ?? DEFAULT_LIMIT;

    const rows = await this.prisma.payment.findMany({
      where: {
        merchantId,
        mode,
        ...(query.status ? { status: query.status } : {}),
        ...(query.reference ? { reference: query.reference } : {}),
        // Ids are UUIDv7, which sort by time, so older is just smaller
        ...(query.startingAfter ? { id: { lt: query.startingAfter } } : {}),
      },
      orderBy: { id: 'desc' },
      // One row more than asked for
      // If it comes back there is another page, and no COUNT was needed
      take: limit + 1,
    });

    return { data: rows.slice(0, limit), hasMore: rows.length > limit };
  }

  // findFirst, because the id alone is not the filter
  // Somebody else's payment is a 404, since a 403 confirms the id is real
  async get(merchantId: string, mode: KeyMode, id: string): Promise<Payment> {
    const payment = await this.prisma.payment.findFirst({
      where: { id, merchantId, mode },
    });

    if (!payment) {
      throw new NotFoundException('payment not found');
    }

    return payment;
  }

  // Counting rows and adding one gives two requests the same number
  // Two payments on one index would share an address
  // nextval cannot hand out the same number twice
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

import { Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  fiatExponent,
  KeyMode,
  type Payment,
  Prisma,
  PrismaService,
} from '@app/shared';
import { AiAvailabilityService } from './ai-availability.service';
import { GroqClient } from './groq.client';
import { PaymentFilterDto } from './payment-filter.dto';

const RESULT_LIMIT = 100;

// Two people asking the same thing costs one call rather than two
// In this process only, the same as the rate cache: a second api container
// would build its own and neither would be wrong
const CACHE_LIMIT = 200;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// bech32 on signet and mainnet, plus the two older base58 forms
// Loose on purpose: this only decides whether to spend a model call
const ADDRESS = /^(tb1|bc1|[13])[a-z0-9]{10,}$/i;

// The question arrives as the user message and never inside these lines, so a
// merchant typing an instruction is data being read and not an order I follow
const SYSTEM_PROMPT = [
  'You turn a question about a merchant crypto payments into a json filter.',
  '',
  'Answer with json only. One object, no prose.',
  '',
  'Every field is optional. Omit anything the question does not ask for.',
  '- status: array of PENDING, CONFIRMING, PAID, UNDERPAID, EXPIRED, REVERSED, FAILED',
  '- fiatCurrency: one of GEL, USD, EUR',
  '- minAmount: whole units as a string, at most two decimals, like "50" or "50.00"',
  '- maxAmount: same shape as minAmount',
  '- withinDays: whole number of days back from now, 1 to 365',
  '- reference: part of the order number the merchant chose',
  '',
  'Wording:',
  '- succeeded, settled, complete and paid all mean PAID',
  '- in progress, awaiting payment and unconfirmed mean PENDING and CONFIRMING',
  '- refunded and reversed mean REVERSED',
  '- always set fiatCurrency alongside an amount, using GEL when none is named',
  '',
  'If nothing in the question maps to a field, answer with {}.',
].join('\n');

export interface SearchOutcome {
  payments: Payment[];
  // Written from the validated filter, never by the model
  // A sentence it made up could disagree with the filter it returned
  interpretation: string | null;
  usedAi: boolean;
  // Whether there were more matches than came back
  // A capped answer that looks complete is worse than one that says it is not
  truncated: boolean;
}

@Injectable()
export class PaymentSearchService {
  private readonly logger = new Logger(PaymentSearchService.name);

  private readonly interpreted = new Map<string, PaymentFilterDto>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly groq: GroqClient,
    private readonly availability: AiAvailabilityService,
  ) {}

  async search(
    merchantId: string,
    mode: KeyMode,
    q: string,
  ): Promise<SearchOutcome> {
    const term = q.trim();

    // The dto allows one character, so a box holding only spaces gets this far
    // Without it that trims to nothing and goes on to ask a model about it
    if (term.length === 0) {
      return {
        payments: [],
        interpretation: null,
        usedAi: false,
        truncated: false,
      };
    }

    if (looksLikeIdentifier(term)) {
      const found = await this.literal(merchantId, mode, term);

      return { ...found, interpretation: null, usedAi: false };
    }

    const filter = await this.interpret(term);

    if (!filter) {
      const found = await this.literal(merchantId, mode, term);

      return { ...found, interpretation: null, usedAi: false };
    }

    return {
      ...(await this.filtered(merchantId, mode, filter)),
      interpretation: this.describe(filter),
      usedAi: true,
    };
  }

  private async interpret(term: string): Promise<PaymentFilterDto | null> {
    const key = term.toLowerCase();
    const cached = this.interpreted.get(key);

    // Checked before the breaker, so a sentence somebody already asked keeps
    // working through an outage
    if (cached) {
      return cached;
    }

    if (!this.availability.shouldTry()) {
      return null;
    }

    let answer: string;

    try {
      answer = await this.groq.complete(SYSTEM_PROMPT, term);
      this.availability.recordSuccess();
    } catch (error) {
      this.availability.recordFailure(error);

      return null;
    }

    // Parsed outside the try above, and the breaker is left alone if it fails
    // A provider that answers badly is a provider that is working, and opening
    // the breaker on one malformed reply would take the feature off everyone
    // for five minutes over a single odd question
    let raw: unknown;

    try {
      raw = JSON.parse(answer);
    } catch {
      this.logger.warn('the model answered with something that is not json');

      return null;
    }

    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return null;
    }

    const filter = plainToInstance(
      PaymentFilterDto,
      normalize(raw as Record<string, unknown>),
    );
    // whitelist drops every property this class does not declare, so a field
    // the model invented is gone before anything downstream reads it
    const errors = await validate(filter, { whitelist: true });

    if (errors.length > 0) {
      this.logger.warn('the model answered with a filter I cannot use');

      return null;
    }

    // An empty filter matches everything the merchant has, which is not what
    // somebody who typed a sentence was asking for
    if (this.isEmpty(filter)) {
      return null;
    }

    this.remember(key, filter);

    return filter;
  }

  // Only answers I could use are kept
  // Caching a failure would stop a term retrying after the provider recovers
  private remember(key: string, filter: PaymentFilterDto): void {
    if (this.interpreted.size >= CACHE_LIMIT) {
      const oldest = this.interpreted.keys().next().value;

      if (oldest !== undefined) {
        this.interpreted.delete(oldest);
      }
    }

    this.interpreted.set(key, filter);
  }

  private isEmpty(filter: PaymentFilterDto): boolean {
    return (
      !filter.status?.length &&
      !filter.fiatCurrency &&
      !filter.minAmount &&
      !filter.maxAmount &&
      filter.withinDays === undefined &&
      !filter.reference
    );
  }

  private async filtered(
    merchantId: string,
    mode: KeyMode,
    filter: PaymentFilterDto,
  ): Promise<{ payments: Payment[]; truncated: boolean }> {
    // The filter is read one named field at a time and never spread
    //
    // merchantId and mode go last, because the last key wins in a spread
    // Someone shortening this to ...filter one day still cannot widen the scope
    const where: Prisma.PaymentWhereInput = {
      ...(filter.status?.length ? { status: { in: filter.status } } : {}),
      ...(filter.fiatCurrency ? { fiatCurrency: filter.fiatCurrency } : {}),
      ...this.amountRange(filter),
      ...(filter.withinDays === undefined
        ? {}
        : {
            createdAt: {
              gte: new Date(Date.now() - filter.withinDays * 86_400_000),
            },
          }),
      ...(filter.reference
        ? { reference: { contains: filter.reference, mode: 'insensitive' } }
        : {}),
      merchantId,
      mode,
    };

    return this.take(where);
  }

  // A bound with no currency would compare 50 GEL against 50 USD as if they
  // were one number, so either both survive or neither does
  private amountRange(filter: PaymentFilterDto): Prisma.PaymentWhereInput {
    if (!filter.fiatCurrency || (!filter.minAmount && !filter.maxAmount)) {
      return {};
    }

    const exponent = fiatExponent(filter.fiatCurrency);

    return {
      fiatAmount: {
        ...(filter.minAmount
          ? {
              gte: new Prisma.Decimal(toMinorUnits(filter.minAmount, exponent)),
            }
          : {}),
        ...(filter.maxAmount
          ? {
              lte: new Prisma.Decimal(toMinorUnits(filter.maxAmount, exponent)),
            }
          : {}),
      },
    };
  }

  private async literal(
    merchantId: string,
    mode: KeyMode,
    term: string,
  ): Promise<{ payments: Payment[]; truncated: boolean }> {
    const or: Prisma.PaymentWhereInput[] = [
      { reference: { contains: term, mode: 'insensitive' } },
      { address: { contains: term, mode: 'insensitive' } },
    ];

    // id is a uuid column, so it takes an equals rather than a contains
    if (UUID.test(term)) {
      or.push({ id: term });
    }

    return this.take({ merchantId, mode, OR: or });
  }

  // One row more than I will hand back, so whether there are others is known
  // without a second counting query
  private async take(
    where: Prisma.PaymentWhereInput,
  ): Promise<{ payments: Payment[]; truncated: boolean }> {
    const rows = await this.prisma.payment.findMany({
      where,
      orderBy: { id: 'desc' },
      take: RESULT_LIMIT + 1,
    });

    return {
      payments: rows.slice(0, RESULT_LIMIT),
      truncated: rows.length > RESULT_LIMIT,
    };
  }

  private describe(filter: PaymentFilterDto): string {
    const statuses = filter.status?.length
      ? `${filter.status.map((status) => status.toLowerCase()).join(' or ')} `
      : '';

    const parts = [`${statuses}payments`];
    const currency = filter.fiatCurrency;

    // "or more" and "or less", because the bounds are gte and lte and a payment
    // of exactly 50 is included
    // This line is the only reason a merchant can trust a filter they did not
    // write, so it says what ran rather than roughly what ran
    if (currency && filter.minAmount && filter.maxAmount) {
      parts.push(
        `between ${filter.minAmount} and ${filter.maxAmount} ${currency}`,
      );
    } else if (currency && filter.minAmount) {
      parts.push(`of ${filter.minAmount} ${currency} or more`);
    } else if (currency && filter.maxAmount) {
      parts.push(`of ${filter.maxAmount} ${currency} or less`);
    } else if (currency) {
      parts.push(`in ${currency}`);
    }

    if (filter.withinDays !== undefined) {
      parts.push(
        filter.withinDays === 1
          ? 'in the last day'
          : `in the last ${filter.withinDays} days`,
      );
    }

    if (filter.reference) {
      parts.push(`with a reference containing ${filter.reference}`);
    }

    return parts.join(' ');
  }
}

// The model gets the shape right most of the time and not every time
// One status instead of an array, or 50 instead of "50", are both worth
// straightening out rather than throwing a good answer away over
//
// This only reshapes what is already there and adds nothing, so the class is
// still the thing that decides what survives
function normalize(raw: Record<string, unknown>): Record<string, unknown> {
  const shaped: Record<string, unknown> = {};

  // A null field means the model had nothing to say, so it is dropped here
  // rather than carried
  // IsOptional skips null as well as undefined, so a null would otherwise pass
  // the whitelist and then fail every === undefined check downstream
  for (const [field, value] of Object.entries(raw)) {
    if (value !== null) {
      shaped[field] = value;
    }
  }

  if (typeof shaped.status === 'string') {
    shaped.status = [shaped.status];
  }

  for (const field of ['minAmount', 'maxAmount'] as const) {
    if (typeof shaped[field] === 'number') {
      shaped[field] = String(shaped[field]);
    }
  }

  return shaped;
}

// What goes straight to a text match instead of costing a model call
//
// A payment id, an address, and a reference, which is the merchant's own order
// number and so nearly always carries a digit. Everything else is a question,
// including the one word ones: underpaid, refunded and expired are the shortest
// things anybody types and none of them is an identifier
function looksLikeIdentifier(term: string): boolean {
  if (UUID.test(term) || ADDRESS.test(term)) {
    return true;
  }

  return !term.includes(' ') && /\d/.test(term);
}

// "50" with an exponent of 2 comes out as 5000, and "0.5" as 50
// Money reaches the database as an integer or it does not reach it at all
function toMinorUnits(amount: string, exponent: number): string {
  const [whole, fraction = ''] = amount.split('.');
  const padded = fraction.padEnd(exponent, '0').slice(0, exponent);

  return BigInt(`${whole}${padded}`).toString();
}

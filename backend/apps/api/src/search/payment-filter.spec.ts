import { describe, expect, it } from '@jest/globals';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaymentFilterDto } from './payment-filter.dto';

// What the model answers is the only untrusted input in this feature, and this
// class is the whole boundary it has to cross
// So the cases here are the ones I would try if I were attacking it
async function check(raw: unknown) {
  const filter = plainToInstance(PaymentFilterDto, raw);
  const errors = await validate(filter, { whitelist: true });

  return { filter, rejected: errors.length > 0 };
}

// The same drop the service does before validating
function stripNulls(raw: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(raw).filter(([, value]) => value !== null),
  );
}

describe('PaymentFilterDto', () => {
  describe('fields it does not declare', () => {
    it('drops one naming another merchant', async () => {
      const { filter } = await check({
        merchantId: 'someone-else',
        status: ['PAID'],
      });

      expect(filter).not.toHaveProperty('merchantId');
      expect(filter.status).toEqual(['PAID']);
    });

    it('drops one naming a mode', async () => {
      const { filter } = await check({ mode: 'LIVE', status: ['PAID'] });

      expect(filter).not.toHaveProperty('mode');
    });

    it('drops a prisma operator smuggled alongside a real field', async () => {
      const { filter } = await check({
        status: ['PAID'],
        OR: [{ merchantId: { not: 'x' } }],
      });

      expect(filter).not.toHaveProperty('OR');
    });
  });

  describe('status', () => {
    it('refuses one that is not a status', async () => {
      expect((await check({ status: ['PAID', 'DROP TABLE'] })).rejected).toBe(
        true,
      );
    });

    it('refuses a bare string, which normalize reshapes before this runs', async () => {
      expect((await check({ status: 'PAID' })).rejected).toBe(true);
    });

    it('refuses more statuses than exist', async () => {
      const status = Array<string>(8).fill('PAID');

      expect((await check({ status })).rejected).toBe(true);
    });
  });

  describe('money', () => {
    it('refuses a currency I do not support', async () => {
      expect((await check({ fiatCurrency: 'XYZ' })).rejected).toBe(true);
    });

    it('refuses scientific notation', async () => {
      expect((await check({ minAmount: '1e9' })).rejected).toBe(true);
    });

    it('refuses more decimals than a minor unit has', async () => {
      expect((await check({ minAmount: '50.123' })).rejected).toBe(true);
    });

    it('refuses a negative amount', async () => {
      expect((await check({ minAmount: '-50' })).rejected).toBe(true);
    });

    it('refuses an amount long enough to overflow the column', async () => {
      expect((await check({ maxAmount: '9'.repeat(13) })).rejected).toBe(true);
    });
  });

  // The trap here is that IsOptional skips null as well as undefined, so a null
  // survives the whitelist and then fails every === undefined check after it.
  // normalize drops nulls before this runs, and these assert the class behaves
  // as the rest of the code expects once it has
  describe('null', () => {
    it('lets a null through, which is why normalize drops it first', async () => {
      const { filter, rejected } = await check({ withinDays: null });

      expect(rejected).toBe(false);
      expect(filter.withinDays).toBeNull();
    });

    it('is absent once normalize has dropped it', async () => {
      const { filter, rejected } = await check(
        stripNulls({ status: ['PAID'], withinDays: null }),
      );

      expect(rejected).toBe(false);
      expect(filter.withinDays).toBeUndefined();
    });
  });

  describe('bounds', () => {
    it('refuses a window past a year', async () => {
      expect((await check({ withinDays: 999_999 })).rejected).toBe(true);
    });

    it('refuses a window of zero', async () => {
      expect((await check({ withinDays: 0 })).rejected).toBe(true);
    });

    it('refuses a reference longer than the column', async () => {
      expect((await check({ reference: 'x'.repeat(65) })).rejected).toBe(true);
    });

    it('refuses an object where a string belongs', async () => {
      expect((await check({ reference: { $ne: null } })).rejected).toBe(true);
    });
  });

  it('keeps a filter that asks for something real', async () => {
    const { filter, rejected } = await check({
      status: ['PAID', 'UNDERPAID'],
      minAmount: '50',
      fiatCurrency: 'GEL',
      withinDays: 7,
    });

    expect(rejected).toBe(false);
    expect(filter.status).toEqual(['PAID', 'UNDERPAID']);
    expect(filter.minAmount).toBe('50');
    expect(filter.withinDays).toBe(7);
  });

  // A script tag is only ever text: it reaches the database as a bound
  // parameter and React escapes it on the way back out
  it('treats a script tag as an ordinary reference', async () => {
    const { rejected } = await check({
      reference: '<script>alert(1)</script>',
    });

    expect(rejected).toBe(false);
  });
});

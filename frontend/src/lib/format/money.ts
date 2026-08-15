// Formatting money without ever touching a float
//
// Amounts arrive as strings of whole numbers in the smallest unit. To display
// them I slice the digit string, I never divide. Dividing by 100 turns 1050
// into a float and floats cannot represent every decimal, which in a ledger is
// a real loss. The same rule as the backend, applied at the other edge

import type { MinorUnits } from '@/types';

const FIAT_DECIMALS: Record<string, number> = {
  GEL: 2,
  USD: 2,
  EUR: 2,
  TRY: 2,
  JPY: 0,
};

const CRYPTO_DECIMALS: Record<string, number> = {
  BTC: 8,
  LTC: 8,
  BCH: 8,
  DASH: 8,
  ZEC: 8,
  BTG: 8,
  ETH: 18,
  USDT: 6,
};

export function fiatDecimals(currency: string): number {
  return FIAT_DECIMALS[currency.toUpperCase()] ?? 2;
}

export function cryptoDecimals(currency: string): number {
  return CRYPTO_DECIMALS[currency.toUpperCase()] ?? 8;
}

// Split a whole-number string into a decimal string by moving the point, not by
// dividing
function shift(minor: MinorUnits, decimals: number): { whole: string; frac: string; negative: boolean } {
  const negative = minor.startsWith('-');
  const digits = (negative ? minor.slice(1) : minor).replace(/\D/g, '') || '0';
  if (decimals === 0) return { whole: digits, frac: '', negative };
  const padded = digits.padStart(decimals + 1, '0');
  return {
    whole: padded.slice(0, padded.length - decimals),
    frac: padded.slice(padded.length - decimals),
    negative,
  };
}

// Intl handles BigInt natively, so grouping never goes through a float either
function group(whole: string, locale = 'en-US'): string {
  try {
    return new Intl.NumberFormat(locale, { useGrouping: true }).format(BigInt(whole));
  } catch {
    return whole;
  }
}

export function formatFiat(minor: MinorUnits, currency: string): string {
  const decimals = fiatDecimals(currency);
  const { whole, frac, negative } = shift(minor, decimals);
  const body = decimals > 0 ? `${group(whole)}.${frac}` : group(whole);
  return `${negative ? '-' : ''}${body}`;
}

export function formatFiatWithCurrency(minor: MinorUnits, currency: string): string {
  return `${formatFiat(minor, currency)} ${currency.toUpperCase()}`;
}

// Crypto keeps trailing zeros off, but always shows at least two decimals so
// amounts stay visually aligned in a table
export function formatCrypto(minor: MinorUnits, currency: string): string {
  const decimals = cryptoDecimals(currency);
  const { whole, frac, negative } = shift(minor, decimals);
  // padEnd never returns an empty string, so the decimals check has to come
  // first or a currency with no decimal places would render as 123.00
  const trimmed = frac.replace(/0+$/, '').padEnd(2, '0');
  const body = decimals > 0 ? `${group(whole)}.${trimmed}` : group(whole);
  return `${negative ? '-' : ''}${body}`;
}

export function formatCryptoWithCurrency(minor: MinorUnits, currency: string): string {
  return `${formatCrypto(minor, currency)} ${currency.toUpperCase()}`;
}

// Turn what someone typed into minor units. Returns null when the input is not
// a clean amount, so the caller shows a validation error instead of guessing
export function parseFiatInput(input: string, currency: string): MinorUnits | null {
  const decimals = fiatDecimals(currency);
  const cleaned = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;

  const [whole, frac = ''] = cleaned.split('.');
  if (frac.length > decimals) return null;

  const combined = `${whole}${frac.padEnd(decimals, '0')}`.replace(/^0+(?=\d)/, '');
  return combined === '' ? '0' : combined;
}

// Sum a column of minor-unit strings. BigInt so it stays exact no matter how
// many rows there are
export function sumMinor(values: MinorUnits[]): MinorUnits {
  return values.reduce((total, v) => total + BigInt(v || '0'), 0n).toString();
}

export function isZero(minor: MinorUnits): boolean {
  return BigInt(minor || '0') === 0n;
}

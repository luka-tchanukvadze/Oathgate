// Fiat is stored in minor units, so this is how many decimals it has
// Crypto is stored in base units, so this is how many make one coin
const FIAT_EXPONENT: Record<string, number> = {
  GEL: 2,
  USD: 2,
  EUR: 2,
};

const CRYPTO_BASE_UNITS: Record<string, string> = {
  BTC: '100000000',
};

export const SUPPORTED_FIAT = Object.keys(FIAT_EXPONENT);
export const SUPPORTED_CRYPTO = Object.keys(CRYPTO_BASE_UNITS);

export function fiatExponent(currency: string): number {
  const exponent = FIAT_EXPONENT[currency];

  if (exponent === undefined) {
    throw new Error(`no minor unit defined for ${currency}`);
  }

  return exponent;
}

export function cryptoBaseUnits(currency: string): string {
  const units = CRYPTO_BASE_UNITS[currency];

  if (units === undefined) {
    throw new Error(`no base unit defined for ${currency}`);
  }

  return units;
}

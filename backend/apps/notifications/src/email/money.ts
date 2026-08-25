// Integer strings, never a float. The exponent rides on the event so I never
// have to guess how many decimals a currency has
export function formatMinorUnits(amount: string, exponent: number): string {
  const negative = amount.startsWith('-');
  const digits = (negative ? amount.slice(1) : amount).padStart(
    exponent + 1,
    '0',
  );

  const whole = digits.slice(0, digits.length - exponent);
  const fraction =
    exponent > 0 ? `.${digits.slice(digits.length - exponent)}` : '';

  return `${negative ? '-' : ''}${whole}${fraction}`;
}

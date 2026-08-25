import { createHmac } from 'node:crypto';

// Stripe's header shape, copied deliberately
// It goes out looking like t=1755432000,v1=8f3a2c...
// The v1 prefix leaves room to change algorithm without breaking anyone
export function signPayload(
  secret: string,
  timestampSeconds: number,
  body: string,
): string {
  const mac = createHmac('sha256', secret)
    .update(`${timestampSeconds}.${body}`)
    .digest('hex');

  return `t=${timestampSeconds},v1=${mac}`;
}

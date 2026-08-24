import { createHmac } from 'node:crypto';

// Stripe's header shape, copied deliberately. Merchants have already written
// code against `t=...,v1=...` and the version prefix leaves room to change the
// algorithm later without breaking anyone still checking v1
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

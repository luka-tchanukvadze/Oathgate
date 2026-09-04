import { BadRequestException } from '@nestjs/common';

// Matches the column, so an oversized key is a 400 not a write error
const MAX_KEY_LENGTH = 255;

// Required, not optional
// A retried create without one is a second invoice for the same order
export function requireIdempotencyKey(key: string | undefined): string {
  if (!key || key.length > MAX_KEY_LENGTH) {
    throw new BadRequestException(
      `Idempotency-Key header is required and must be at most ${MAX_KEY_LENGTH} characters`,
    );
  }

  return key;
}

import { createHash, randomBytes } from 'node:crypto';
import { KeyMode } from '../generated/prisma/client';

// 24 bytes of randomness, which is 48 hex characters
// There is nothing here a person chose, so there is nothing to guess
const KEY_BYTES = 24;

// sk_test_ is 8 characters, so this keeps the first 8 of the random part
// Long enough for a merchant to tell two keys apart in a list, short enough to
// be worth nothing to anyone who reads it
const PREFIX_LENGTH = 16;

export interface NewApiKey {
  key: string;
  keyHash: string;
  keyPrefix: string;
}

// The guard hashes a presented key, this file makes one, and the seed makes one
// Three copies of the same one-liner is how two of them end up on different
// algorithms and nobody's key works any more
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

// The plain key exists only in the value this returns
// It is shown once and never stored, so a database dump hands nobody a
// working credential
export function newApiKey(mode: KeyMode): NewApiKey {
  const key = `sk_${mode.toLowerCase()}_${randomBytes(KEY_BYTES).toString('hex')}`;

  return {
    key,
    keyHash: hashApiKey(key),
    keyPrefix: key.slice(0, PREFIX_LENGTH),
  };
}

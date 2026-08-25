import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// AES-256, and the GCM part is the bit that matters
// GCM checks the stored value was not altered before it decrypts it
// CBC would happily decrypt a tampered row into a wrong secret
const ALGORITHM = 'aes-256-gcm';

const IV_BYTES = 12;
const KEY_BYTES = 32;

// Stored as v1:iv:tag:ciphertext
// The version is there so I can add a second key later
// Without it I would be guessing how an old row was written
const VERSION = 'v1';

@Injectable()
export class SecretCipher {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const raw = config.getOrThrow<string>('WEBHOOK_SECRET_KEY').trim();

    // Hex when it looks like hex, base64 otherwise
    // Hex survives a .env better: no padding character, no slashes to lose
    const key = /^[0-9a-f]{64}$/i.test(raw)
      ? Buffer.from(raw, 'hex')
      : Buffer.from(raw, 'base64');

    // Checked at boot rather than at the first webhook
    // A short key would otherwise fail the day someone registers an endpoint
    if (key.length !== KEY_BYTES) {
      throw new Error(
        `WEBHOOK_SECRET_KEY must decode to ${KEY_BYTES} bytes, got ${key.length}`,
      );
    }

    this.key = key;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    return [
      VERSION,
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      ciphertext.toString('base64url'),
    ].join(':');
  }

  decrypt(stored: string): string {
    const parts = stored.split(':');

    if (parts.length !== 4 || parts[0] !== VERSION) {
      throw new Error('stored secret is not in a format I recognise');
    }

    const [, iv, tag, ciphertext] = parts as [string, string, string, string];

    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}

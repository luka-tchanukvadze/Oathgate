import type { KeyMode } from '../generated/prisma/client';

// What the guard leaves behind on the request. Mode comes off the key rather
// than the body, which is what stops a test key ever reaching live rows
export interface AuthenticatedMerchant {
  merchantId: string;
  apiKeyId: string;
  mode: KeyMode;
}

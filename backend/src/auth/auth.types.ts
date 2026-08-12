import type { KeyMode } from '../generated/prisma/client';

// What ApiKeyGuard leaves behind. Mode comes off the key rather than the body,
// which is what stops a test key ever reaching live rows
export interface AuthenticatedMerchant {
  merchantId: string;
  apiKeyId: string;
  mode: KeyMode;
}

// What SessionGuard leaves behind. No mode, because a browser can switch
// between test and live
export interface AuthenticatedSession {
  sessionId: string;
  merchantId: string;
}

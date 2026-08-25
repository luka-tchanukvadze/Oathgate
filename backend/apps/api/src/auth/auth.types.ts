import { type KeyMode } from '@app/shared';

// What ApiKeyGuard leaves behind
// Mode comes off the key, not the body, so a test key cannot reach live
export interface AuthenticatedMerchant {
  merchantId: string;
  apiKeyId: string;
  mode: KeyMode;
}

// What SessionGuard leaves behind
// No mode, because a browser can switch between test and live
export interface AuthenticatedSession {
  sessionId: string;
  merchantId: string;
}

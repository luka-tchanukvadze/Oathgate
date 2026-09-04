import { type KeyMode } from '@app/shared';

// Who a payment gets created on behalf of
// An api key fills in all three
// A dashboard session fills the first two and has no key to name
export interface PaymentAuthor {
  merchantId: string;
  mode: KeyMode;
  apiKeyId: string | null;
}

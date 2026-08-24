import type { KeyMode } from '../generated/prisma/client';

// Deliberately not the same shape as the webhook body. That one is a public
// contract I cannot change without breaking merchants. This one is internal, so
// it can carry routing fields at the top level where a consumer can filter on
// them without parsing data
export interface DomainEvent {
  id: string;
  type: string;
  merchantId: string;
  mode: KeyMode;
  createdAt: string;
  data: unknown;
}

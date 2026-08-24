// A union written out by hand rather than the gateway's Prisma enum. This file
// is the wire format between two services, so it must not depend on either
// side's database, or the boundary is decoration
export type EventMode = 'TEST' | 'LIVE';

// Deliberately not the same shape as the webhook body. That one is a public
// contract I cannot change without breaking merchants. This one is internal, so
// it carries routing fields at the top level where a consumer can filter on them
// without parsing data
export interface DomainEvent {
  id: string;
  type: string;
  merchantId: string;
  mode: EventMode;
  createdAt: string;
  data: unknown;
}

// Written out by hand rather than reusing my Prisma enum. This is the wire format
// between two services, so it cannot depend on either side's database
export type EventMode = 'TEST' | 'LIVE';

// Not the webhook body shape. Merchants depend on that one, this one is mine, so
// it puts the routing fields at the top where a consumer can filter cheaply
export interface DomainEvent {
  id: string;
  type: string;
  merchantId: string;
  mode: EventMode;
  createdAt: string;
  data: unknown;
}

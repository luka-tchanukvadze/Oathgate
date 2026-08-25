// Written by hand rather than reusing my Prisma enum
// The wire format cannot depend on either side's database
export type EventMode = 'TEST' | 'LIVE';

// Not the webhook body shape, which merchants depend on
// This one is mine, so routing fields sit at the top for cheap filtering
export interface DomainEvent {
  id: string;
  type: string;
  merchantId: string;
  mode: EventMode;
  createdAt: string;
  data: unknown;
}

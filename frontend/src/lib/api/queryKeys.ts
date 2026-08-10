import type { KeyMode } from '@/types';

// One place for every cache key, so an invalidation after a mutation cannot
// silently miss a screen
export const queryKeys = {
  payments: (mode: KeyMode) => ['payments', mode] as const,
  payment: (paymentId: string) => ['payment', paymentId] as const,
  paymentDetail: (paymentId: string) => ['payment-detail', paymentId] as const,
  ledger: (mode: KeyMode) => ['ledger', mode] as const,
  accounts: (mode: KeyMode) => ['accounts', mode] as const,
  apiKeys: () => ['api-keys'] as const,
  webhooks: (mode: KeyMode) => ['webhooks', mode] as const,
  insights: (mode: KeyMode) => ['insights', mode] as const,
  merchant: () => ['merchant'] as const,
};

export const extraKeys = {
  events: (mode: 'TEST' | 'LIVE') => ['events', mode] as const,
  endpoint: () => ['webhook-endpoint'] as const,
};

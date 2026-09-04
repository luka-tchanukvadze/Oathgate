'use client';

import { useQuery } from '@tanstack/react-query';
import { listPayments, queryKeys } from '@/lib/api';
import { useMode } from './use-mode';

// Open means the merchant is still waiting on the chain
// Anything else has landed somewhere and is not a thing to chase

// The rail and the phone bar both badge this number, and the same key means one
// request feeds both. Two copies of the filter is how they drift apart
export function useOpenPaymentCount(): number {
  const { mode } = useMode();

  const payments = useQuery({
    queryKey: queryKeys.payments(mode),
    queryFn: () => listPayments(mode),
  });

  return (payments.data ?? []).filter(
    (payment) => payment.status === 'PENDING' || payment.status === 'CONFIRMING',
  ).length;
}

'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ModeProvider } from '@/hooks/use-mode';
import { ToastProvider } from '@/components/ui/toast';

export function Providers({ children }: { children: React.ReactNode }) {
  // Created in state so React does not build a new client on every render, and
  // so each browser tab gets its own cache
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            retry: 1,
            // A failed background refetch keeps the last good data on screen
            // rather than blanking the page, which on a balance screen would
            // look identical to an empty account
            placeholderData: <T,>(previous: T) => previous,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ModeProvider>{children}</ModeProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

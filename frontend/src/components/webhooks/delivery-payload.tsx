'use client';

import { useQuery } from '@tanstack/react-query';
import { getWebhookDelivery, queryKeys } from '@/lib/api';
import { JsonBlock } from '@/components/ui/json-block';
import { Skeleton } from '@/components/ui/skeleton';

// Its own component because it fetches, and a hook cannot live inside the map
// that renders the rows
//
// Only mounted when a row is open, so a list of fifty deliveries costs fifty
// list rows and nothing else
export function DeliveryPayload({ deliveryId }: { deliveryId: string }) {
  const detail = useQuery({
    queryKey: queryKeys.webhook(deliveryId),
    queryFn: () => getWebhookDelivery(deliveryId),
    staleTime: 60_000,
  });

  if (detail.isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  if (!detail.data) {
    return null;
  }

  return (
    <div className="space-y-3">
      <JsonBlock value={detail.data.payload} title="Payload" />

      {detail.data.attemptLog.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-subtle">Attempts</p>
          <ul className="space-y-1">
            {detail.data.attemptLog.map((attempt) => (
              <li
                key={attempt.attempt}
                className="flex flex-wrap gap-3 text-xs text-ink-subtle"
              >
                <span className="mono text-ink">#{attempt.attempt}</span>
                <span>
                  {attempt.responseStatus
                    ? `HTTP ${attempt.responseStatus}`
                    : 'no answer'}
                </span>
                <span>{attempt.durationMs}ms</span>
                {attempt.error && (
                  <span className="truncate text-danger">{attempt.error}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

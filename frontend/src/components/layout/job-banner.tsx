'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { getStatus, queryKeys } from '@/lib/api';

// Nothing on any screen used to say a background job had stopped. The chain
// watcher was quiet for hours once and the first sign was a failure somewhere
// else entirely, so this exists to make quiet failures loud
//
// It says what stopped being true rather than which service is down, because a
// merchant cannot act on a service name
export function JobBanner() {
  const status = useQuery({
    queryKey: queryKeys.status(),
    queryFn: getStatus,
    // Slower than the jobs themselves, since a banner that flickers on one slow
    // sweep teaches people to ignore it
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const stalled = status.data?.degraded ?? [];

  // A failed request means nothing here. The API being unreachable is already
  // obvious from every other screen, and guessing at it would show this banner
  // for a moment on every reconnect
  if (status.data === undefined || stalled.length === 0) {
    return null;
  }

  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-2.5 rounded-well px-3.5 py-3 text-sm"
      style={{ backgroundColor: 'var(--warn-bg)', color: 'var(--warn-fg)' }}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold">
          {stalled.length === 1
            ? `${stalled[0].label} is not working right now`
            : `${stalled.length} parts of the gateway are not working right now`}
        </p>
        <ul className="mt-1 space-y-0.5 leading-relaxed">
          {stalled.map((job) => (
            <li key={job.label}>{job.effect}</li>
          ))}
        </ul>
        <p className="mt-1.5 text-xs opacity-80">
          Nothing already recorded is affected, and simulating a payment still works.
        </p>
      </div>
    </div>
  );
}

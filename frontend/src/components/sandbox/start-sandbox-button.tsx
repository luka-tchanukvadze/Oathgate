'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Loader2 } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { getSession } from '@/lib/api/auth';
import { createSandbox } from '@/lib/api/sandbox';
import { useToast } from '@/components/ui/toast';

// The API's own words, not a house sentence covering everything
// "no usable exchange rate" says where to go and look, "try again" does not
function describe(error: unknown): { title: string; detail: string } {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return {
        title: 'A few sandboxes came from this address already',
        detail: 'Try again in an hour, or sign in if you have an account',
      };
    }

    return { title: 'Could not open a sandbox', detail: error.message };
  }

  return {
    title: 'Could not reach the API',
    detail: 'Nothing answered, so it is either down or not reachable from here',
  };
}

// One click has to end with a stranger inside a dashboard that has data in it,
// so this creates the account, seeds it and signs in before it navigates
export function StartSandboxButton({
  className,
  label = 'Open the demo',
}: {
  className: string;
  label?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function open() {
    if (busy) return;

    setBusy(true);

    try {
      // Anyone already signed in keeps the account they signed in to
      // Otherwise clicking this would swap a real merchant's cookie for a
      // sandbox one and look exactly like being logged out
      const existing = await getSession();

      // A new workspace means every cached answer belongs to somebody else
      // The query keys carry the mode and not the merchant, so without this the
      // dashboard paints the last visitor's payments until the refetch lands
      if (!existing) {
        await createSandbox();
        queryClient.clear();
      }

      router.push('/dashboard');
    } catch (error) {
      setBusy(false);

      // A toast rather than a line under the button
      // This button sits in a header, in a hero and on the login card, and a
      // box that appears in the flow moves whichever one it lands in
      const { title, detail } = describe(error);
      toast.error(title, detail);
    }
  }

  return (
    <button type="button" onClick={open} disabled={busy} className={className}>
      {busy ? (
        <>
          Setting up your workspace
          <Loader2 className="size-4 animate-spin" aria-hidden />
        </>
      ) : (
        <>
          {label}
          <ArrowRight className="size-4" aria-hidden />
        </>
      )}
    </button>
  );
}

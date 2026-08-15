'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { logout } from '@/lib/api/auth';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

export function AccountMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointer(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function signOut() {
    setPending(true);
    try {
      await logout();
    } finally {
      // Cleared whether or not the request succeeded. Leaving another
      // merchant's payments in the cache after a sign out is worse than an
      // unrevoked session row, and the row expires on its own anyway
      queryClient.clear();
      router.replace('/login');
    }
  }

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account"
        className="grid size-7 place-items-center rounded-full bg-ink text-2xs font-semibold text-on-accent"
      >
        {initials(name)}
      </button>

      {open && (
        <div
          role="menu"
          className="shadow-card absolute right-0 top-9 z-40 w-56 rounded-md border border-line bg-surface p-1"
        >
          <div className="border-b border-line px-3 py-2">
            <p className="truncate text-xs font-medium text-ink">{name}</p>
            <p className="truncate text-2xs text-ink-subtle">{email}</p>
          </div>

          <Link
            href="/dashboard/guide"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block rounded px-3 py-2 text-xs text-ink-muted hover:bg-surface-muted hover:text-ink"
          >
            Integration guide
          </Link>

          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            disabled={pending}
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-ink-muted hover:bg-surface-muted hover:text-ink disabled:opacity-50"
          >
            <LogOut className="size-3.5" aria-hidden />
            {pending ? 'Signing out' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/api/auth';

// Nothing is rendered until the answer is back. Rendering the dashboard first
// and redirecting after would flash a merchant's data at someone who is not
// signed in, however briefly
export function RequireSession({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let live = true;

    getSession()
      .then((session) => {
        if (!live) return;
        if (session) setAllowed(true);
        else router.replace('/login');
      })
      .catch(() => {
        if (live) router.replace('/login');
      });

    return () => {
      live = false;
    };
  }, [router]);

  // This is a convenience, not the security boundary. Every endpoint behind it
  // checks the session again, because anything decided in a browser can be
  // switched off in that browser
  if (!allowed) {
    return <div className="min-h-dvh bg-canvas" aria-busy="true" />;
  }

  return <>{children}</>;
}

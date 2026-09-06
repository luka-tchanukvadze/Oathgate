'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { KeyRound, ScrollText, Webhook } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/dashboard/developers/keys', label: 'API keys', icon: KeyRound },
  { href: '/dashboard/developers/webhooks', label: 'Webhooks', icon: Webhook },
  { href: '/dashboard/developers/events', label: 'Events', icon: ScrollText },
];

// Only on small screens. The sidebar carries this on a desktop, and a second
// row of tabs under it would be the same list twice
export default function DevelopersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <>
      <nav aria-label="Developers" className="mb-6 lg:hidden">
        <ul className="flex gap-1.5 overflow-x-auto pb-1">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.href);

            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-medium transition-colors',
                    active
                      ? 'bg-ink text-on-accent'
                      : 'bg-surface-muted text-ink-muted hover:text-ink',
                  )}
                >
                  <tab.icon className="size-3.5" aria-hidden />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {children}
    </>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Code2, Home, Wallet } from 'lucide-react';
import { useOpenPaymentCount } from '@/hooks/use-open-payments';
import { cn } from '@/lib/utils';

// The four screens worth a thumb. Insights, the guide and the three developer
// pages stay in the drawer, because a bar of six is a bar nobody can hit
const TABS = [
  { href: '/dashboard', label: 'Home', icon: Home, exact: true },
  { href: '/dashboard/payments', label: 'Payments', icon: Activity, badge: true },
  { href: '/dashboard/balance', label: 'Balance', icon: Wallet },
  { href: '/dashboard/developers', label: 'Developers', icon: Code2 },
];

export function BottomNav() {
  const pathname = usePathname();
  const openCount = useOpenPaymentCount();

  return (
    <nav
      aria-label="Sections"
      className="footer-veil fixed inset-x-0 bottom-0 z-30 pt-5 lg:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          const Icon = tab.icon;

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className="flex flex-col items-center gap-1 py-2"
              >
                {/* Same filled pill the rail uses for "you are here", just wide
                    instead of tall. One signal, learned once */}
                <span
                  className={cn(
                    'relative grid h-8 w-16 place-items-center rounded-full transition-colors',
                    active && 'bg-surface-sunken',
                  )}
                >
                  <Icon
                    className={cn('size-5', active ? 'text-ink' : 'text-ink-faint')}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  {tab.badge && openCount > 0 && (
                    <span
                      className="num absolute right-2 top-0 rounded-full px-1.5 text-2xs font-semibold"
                      style={{ backgroundColor: 'var(--warn-bg)', color: 'var(--warn-fg)' }}
                    >
                      {openCount}
                    </span>
                  )}
                </span>

                <span
                  className={cn(
                    'text-2xs font-medium',
                    active ? 'text-ink' : 'text-ink-faint',
                  )}
                >
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

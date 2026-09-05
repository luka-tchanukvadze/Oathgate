'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BookOpen,
  ChevronDown,
  Code2,
  Home,
  KeyRound,
  ScrollText,
  Sparkles,
  Wallet,
  Webhook,
} from 'lucide-react';
import { Logo } from './logo';
import { useOpenPaymentCount } from '@/hooks/use-open-payments';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'Home', icon: Home, exact: true },
  {
    href: '/dashboard/payments',
    label: 'Payments',
    icon: Activity,
    badge: 'open' as const,
  },
  { href: '/dashboard/balance', label: 'Balance', icon: Wallet },
  {
    href: '/dashboard/developers',
    label: 'Developers',
    icon: Code2,
    children: [
      { href: '/dashboard/developers/keys', label: 'API keys', icon: KeyRound },
      {
        href: '/dashboard/developers/webhooks',
        label: 'Webhooks',
        icon: Webhook,
      },
      {
        href: '/dashboard/developers/events',
        label: 'Events',
        icon: ScrollText,
      },
    ],
  },
  { href: '/dashboard/insights', label: 'Insights', icon: Sparkles },
  { href: '/dashboard/guide', label: 'Guide', icon: BookOpen },
];

// One signal for "you are here", not three
// A filled pill says it on its own, so the icon keeps its weight and its colour
// and the row does not also grow a coloured bar
function itemClass(active: boolean) {
  return cn(
    'flex items-center gap-3.5 rounded-full py-3.5 pl-4 pr-4 text-sm transition-colors',
    active
      ? 'bg-surface-sunken font-medium text-ink'
      : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
  );
}

function itemIconClass(active: boolean) {
  return cn('size-[18px] shrink-0', active ? 'text-ink' : 'text-ink-faint');
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const inDevelopers = pathname.startsWith('/dashboard/developers');

  // Open from the start
  // The three things under here are the point of the product, and a collapsed
  // group hides them behind a click nobody knows to make
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (inDevelopers) setOpen(true);
  }, [inDevelopers]);

  const openCount = useOpenPaymentCount();

  return (
    <div className="flex h-full flex-col">
      {/* Centred in the rail rather than pinned to its left edge
          Flush left it read as stranded in the corner, with 36px of margin on
          one side of it and 160px of empty rail on the other */}
      <div className="flex h-24 shrink-0 items-center justify-center px-5">
        <Logo href="/dashboard" />
      </div>

      <nav aria-label="Sections" className="flex-1 overflow-y-auto px-5 pb-5 pt-10">
        <div className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;

            if (!item.children) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={itemClass(active)}
                >
                  <Icon
                    className={itemIconClass(active)}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  {item.label}
                  {item.badge === 'open' && openCount > 0 && (
                    <span
                      className="num ml-auto rounded-full px-2 py-0.5 text-2xs font-semibold"
                      style={{
                        backgroundColor: 'var(--warn-bg)',
                        color: 'var(--warn-fg)',
                      }}
                    >
                      {openCount}
                    </span>
                  )}
                </Link>
              );
            }

            return (
              <div key={item.href} className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setOpen((value) => !value)}
                  aria-expanded={open}
                  className={cn(itemClass(active && !open), 'w-full')}
                >
                  <Icon
                    className={itemIconClass(active && !open)}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  {item.label}
                  <ChevronDown
                    className={cn(
                      'ml-auto size-4 shrink-0 text-ink-faint transition-transform',
                      open && 'rotate-180',
                    )}
                    aria-hidden
                  />
                </button>

                {/* Indented to sit under the parent's label, not under its icon,
                    and with no rail, because the indent already says nested */}
                {open && (
                  <div className="flex flex-col gap-1 pl-7">
                    {item.children.map((child) => {
                      const childActive = pathname.startsWith(child.href);
                      const ChildIcon = child.icon;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={onNavigate}
                          aria-current={childActive ? 'page' : undefined}
                          className={itemClass(childActive)}
                        >
                          <ChildIcon
                            className={itemIconClass(childActive)}
                            strokeWidth={1.75}
                            aria-hidden
                          />
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

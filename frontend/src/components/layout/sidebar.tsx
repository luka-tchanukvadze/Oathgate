'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Activity, BookOpen, ChevronRight, Code2, Home, Sparkles, Wallet } from 'lucide-react';
import { Logo } from './logo';
import { listPayments, queryKeys } from '@/lib/api';
import { useMode } from '@/hooks/use-mode';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'Home', icon: Home, exact: true },
  { href: '/dashboard/payments', label: 'Payments', icon: Activity, badge: 'open' as const },
  { href: '/dashboard/balance', label: 'Balance', icon: Wallet },
  {
    href: '/dashboard/developers',
    label: 'Developers',
    icon: Code2,
    children: [
      { href: '/dashboard/developers/keys', label: 'API keys' },
      { href: '/dashboard/developers/webhooks', label: 'Webhooks' },
      { href: '/dashboard/developers/events', label: 'Events' },
    ],
  },
  { href: '/dashboard/insights', label: 'Insights', icon: Sparkles },
];

const GUIDE = { href: '/dashboard/guide', label: 'Guide', icon: BookOpen };

// A left bar plus tinted text, rather than a grey fill that sat a shade away
// from hover. Applied identically to children so a nested route is as obvious
// as a top level one
function itemClass(active: boolean) {
  return cn(
    'relative flex items-center gap-3 rounded-md py-2.5 pl-3 pr-2.5 text-sm transition-colors',
    active
      ? 'bg-accent-soft font-medium text-accent'
      : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
  );
}

function ActiveBar() {
  // Inside the row. It used to sit outside, almost against the viewport edge
  return <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-accent" aria-hidden />;
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { mode } = useMode();
  const inDevelopers = pathname.startsWith('/dashboard/developers');
  const [open, setOpen] = useState(inDevelopers);

  useEffect(() => {
    if (inDevelopers) setOpen(true);
  }, [inDevelopers]);

  // Same query key as the payments screen, so this is a cache read rather than
  // a second request. Only counts that need acting on get a badge
  const payments = useQuery({ queryKey: queryKeys.payments(mode), queryFn: () => listPayments(mode) });
  const openCount = (payments.data ?? []).filter(
    (p) => p.status === 'PENDING' || p.status === 'CONFIRMING',
  ).length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center border-b border-line px-4 xl:h-16">
        <Logo href="/dashboard" />
      </div>

      <nav aria-label="Sections" className="flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
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
                  {active && <ActiveBar />}
                  <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2.1 : 1.8} aria-hidden />
                  {item.label}
                  {item.badge === 'open' && openCount > 0 && (
                    <span
                      className="num ml-auto rounded px-1.5 py-0.5 text-2xs font-semibold"
                      style={{ backgroundColor: 'var(--warn-bg)', color: 'var(--warn-fg)' }}
                    >
                      {openCount}
                    </span>
                  )}
                </Link>
              );
            }

            return (
              <div key={item.href}>
                <button
                  type="button"
                  onClick={() => setOpen((value) => !value)}
                  aria-expanded={open}
                  className={cn(itemClass(active && !open), 'w-full')}
                >
                  {active && !open && <ActiveBar />}
                  <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2.1 : 1.8} aria-hidden />
                  {item.label}
                  <ChevronRight
                    className={cn('ml-auto size-3 shrink-0 transition-transform', open && 'rotate-90')}
                    aria-hidden
                  />
                </button>

                {open && (
                  <div className="ml-[1.05rem] mt-0.5 flex flex-col gap-0.5 border-l border-line pl-2.5">
                    {item.children.map((child) => {
                      const childActive = pathname.startsWith(child.href);
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={onNavigate}
                          aria-current={childActive ? 'page' : undefined}
                          className={itemClass(childActive)}
                        >
                          {childActive && <ActiveBar />}
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

        <div className="mt-4 border-t border-line pt-3">
          <Link
            href={GUIDE.href}
            onClick={onNavigate}
            aria-current={pathname.startsWith(GUIDE.href) ? 'page' : undefined}
            className={itemClass(pathname.startsWith(GUIDE.href))}
          >
            {pathname.startsWith(GUIDE.href) && <ActiveBar />}
            <GUIDE.icon className="size-[18px] shrink-0" strokeWidth={1.8} aria-hidden />
            {GUIDE.label}
          </Link>
        </div>
      </nav>

      {/* Which workspace you are in, which is the one thing the footer should
          carry. The environment already has a banner across the top */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-t border-line px-3">
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-lg bg-ink text-2xs font-semibold text-on-accent"
        >
          DC
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink">Demo Coffee Co</span>
          <span className="block text-xs text-ink-subtle">Testnet workspace</span>
        </span>
      </div>
    </div>
  );
}

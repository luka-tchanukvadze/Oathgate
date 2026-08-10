'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, Search, X } from 'lucide-react';
import { SidebarNav } from './sidebar';
import { Logo } from './logo';
import { ModeToggle } from '@/components/ui/mode-toggle';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMode } from '@/hooks/use-mode';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { mode } = useMode();
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [liveInfo, setLiveInfo] = useState(false);
  const [term, setTerm] = useState('');
  const router = useRouter();
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const closeNav = useCallback(() => {
    setNavOpen(false);
    // Focus goes back to the button that opened it, otherwise a keyboard user
    // is dropped at the top of the document
    menuButtonRef.current?.focus();
  }, []);

  // The drawer is a modal, so it behaves like one: Escape closes it, Tab stays
  // inside it, and focus starts on the close button
  useEffect(() => {
    if (!navOpen) return;

    const panel = drawerRef.current;
    panel?.querySelector<HTMLElement>('button, a[href]')?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeNav();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;

      const items = Array.from(
        panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
      ).filter((element) => element.offsetParent !== null);
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navOpen, closeNav]);

  function search(event: React.FormEvent) {
    event.preventDefault();
    const q = term.trim();
    setNavOpen(false);
    setSearchOpen(false);
    router.push(q ? `/dashboard/payments?q=${encodeURIComponent(q)}` : '/dashboard/payments');
  }

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:text-on-accent"
      >
        Skip to content
      </a>

      {/* Fixed height and sticky, so the rail below can subtract exactly this
          much. With h-dvh the sidebar footer sat under the fold */}
      <div
        className="sticky top-0 z-30 flex h-7 items-center justify-center px-3 text-center text-2xs font-semibold uppercase tracking-[0.08em]"
        style={{ backgroundColor: 'var(--warn-bg)', color: 'var(--warn-fg)' }}
      >
        <span className="sm:hidden">Bitcoin testnet</span>
        <span className="hidden sm:inline">
          Bitcoin testnet. A real chain, with coins that carry no value
        </span>
      </div>

      <div className="flex">
        <aside className="sticky top-7 hidden h-[calc(100dvh-1.75rem)] w-60 shrink-0 border-r border-line bg-surface lg:block xl:w-72">
          <SidebarNav />
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-7 z-20 border-b border-line bg-surface/85 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-[1480px] items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
              <button
                type="button"
                onClick={() => setNavOpen(true)}
                aria-label="Open navigation"
                className="grid size-9 shrink-0 place-items-center rounded-md text-ink-muted hover:bg-surface-muted lg:hidden"
              >
                <Menu className="size-5" aria-hidden />
              </button>

              <div className="min-w-0 lg:hidden">
                <Logo href="/dashboard" />
              </div>

              <form onSubmit={search} className="hidden min-w-0 flex-1 sm:block sm:max-w-md">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint"
                    aria-hidden
                  />
                  <input
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="Search payments, references, addresses"
                    aria-label="Search"
                    className="h-9 w-full rounded-md bg-surface-muted pl-8 pr-3 text-sm text-ink placeholder:text-ink-faint focus:bg-surface focus:shadow-card focus:outline-none sm:h-8"
                  />
                </div>
              </form>

              <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2.5">
                {/* Phones get a search button instead of a field, so the header
                    does not clip at 320px */}
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  aria-label="Search"
                  className="grid size-9 place-items-center rounded-md text-ink-muted hover:bg-surface-muted sm:hidden"
                >
                  <Search className="size-4" aria-hidden />
                </button>

                <ModeToggle mode={mode} onLockedClick={() => setLiveInfo(true)} />

                <span
                  aria-hidden
                  className="hidden size-7 place-items-center rounded-full bg-ink text-2xs font-semibold text-on-accent sm:grid"
                >
                  DC
                </span>
              </div>
            </div>
          </header>

          <main id="main" className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>
        </div>
      </div>

      {/* Not rendered when closed, so its links cannot be reached by Tab while
          it is off screen */}
      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div onClick={closeNav} className="absolute inset-0 bg-[#0a2540]/45" aria-hidden />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 w-64 bg-surface"
          >
            <button
              type="button"
              onClick={closeNav}
              aria-label="Close navigation"
              className="absolute right-2 top-2.5 z-10 grid size-9 place-items-center rounded-md text-ink-muted hover:bg-surface-muted"
            >
              <X className="size-5" aria-hidden />
            </button>
            <SidebarNav onNavigate={closeNav} />
          </div>
        </div>
      )}

      <Dialog open={searchOpen} onClose={() => setSearchOpen(false)} title="Search">
        <form onSubmit={search}>
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Payment id, reference or address"
            aria-label="Search payments"
            className="h-11 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          />
          <Button type="submit" className="mt-3 w-full">
            Search
          </Button>
        </form>
      </Dialog>

      <Dialog
        open={liveInfo}
        onClose={() => setLiveInfo(false)}
        title="Mainnet is not activated"
        description="This workspace settles on Bitcoin testnet."
      >
        <div className="space-y-4 text-sm leading-relaxed text-ink-muted">
          <p>
            Mainnet settles in Bitcoin that is worth money, which means Oathgate holds customer funds on
            your behalf. Activation requires custody arrangements and regulatory approval, and is not
            enabled for this workspace.
          </p>
          <p>
            You do not need it. Testnet is a real Bitcoin network with real blocks, real confirmations and
            real addresses. You can send coins to any pending payment here and watch it settle for real.
            They are simply free, from a faucet, and worth nothing.
          </p>
          <p>
            Your integration does not change between the two. Keys carry the environment, every record
            carries the environment, and no query crosses between them. Activating swaps one key for
            another and nothing else.
          </p>

          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
            <Link
              href="/dashboard/guide"
              onClick={() => setLiveInfo(false)}
              className="shadow-card inline-flex h-11 items-center justify-center rounded-md bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-muted sm:h-8"
            >
              Read the guide
            </Link>
            <Button onClick={() => setLiveInfo(false)}>Got it</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

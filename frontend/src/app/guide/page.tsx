import Link from 'next/link';
import { Logo } from '@/components/layout/logo';
import { GuideContent } from '@/components/guide/guide-content';
import { StartSandboxButton } from '@/components/sandbox/start-sandbox-button';

// The same guide the dashboard shows, on a route that needs no account
//
// The landing page offers this next to the demo button, and a visitor deciding
// whether to open a workspace should be able to read what one is first
export const metadata = {
  title: 'Integration guide',
  description: 'What Oathgate is, who it is for, and how one payment works.',
};

export default function PublicGuidePage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="mx-auto flex h-20 w-full max-w-6xl items-center px-5 sm:px-8">
        <Logo href="/" compact />
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/login"
            className="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-full px-3 text-sm font-semibold text-ink-muted transition-colors hover:text-ink sm:px-4"
          >
            Sign in
          </Link>
          <StartSandboxButton className="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-ink px-4 text-sm font-semibold text-on-accent transition-transform hover:scale-[1.03] disabled:scale-100 disabled:opacity-70 sm:px-5" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
        <GuideContent signedIn={false} />
      </main>
    </div>
  );
}

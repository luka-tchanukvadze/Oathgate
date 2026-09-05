'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/layout/logo';
import { StartSandboxButton } from '@/components/sandbox/start-sandbox-button';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { login } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      await login(email, password);
      // replace, not push, so the back button does not land on a login form
      // the merchant has already passed
      router.replace('/dashboard');
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : 'Something went wrong',
      );
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo href="/" />
        </div>

        <div className="shadow-card rounded-tile bg-surface p-6 sm:p-7">
          <h1 className="text-lg font-semibold text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-ink-muted">
            The dashboard is for your team. Your servers use an API key instead.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <Field label="Email">
              <Input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </Field>

            <Field label="Password">
              <Input
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>

            {/* One message covering both fields. Saying which one was wrong
                tells a stranger which addresses have accounts */}
            {error && (
              <p
                role="alert"
                className="rounded-well px-3.5 py-2.5 text-xs"
                style={{
                  backgroundColor: 'var(--bad-bg)',
                  color: 'var(--bad-fg)',
                }}
              >
                {error}
              </p>
            )}

            <Button type="submit" loading={pending} className="w-full">
              Sign in
            </Button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-ink-subtle">
            There is no sign up. A real gateway has to check who a business is
            before it moves money for them, and that is a legal process rather
            than a screen. A sandbox behaves the same and takes one click.
          </p>

          <div className="mt-5 flex justify-center">
            <StartSandboxButton
              className="inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold text-ink ring-1 ring-line transition-colors hover:bg-canvas disabled:opacity-70"
              label="Open a sandbox instead"
            />
          </div>
        </div>
      </div>
    </main>
  );
}

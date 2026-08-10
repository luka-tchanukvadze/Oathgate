'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';

// Hand rolled rather than pulling in a toast library, because the whole thing
// is under a hundred lines and a library would arrive with its own theme to
// fight

type Tone = 'success' | 'error';

interface Toast {
  id: number;
  tone: Tone;
  title: string;
  detail?: string;
}

interface ToastContextValue {
  success: (title: string, detail?: string) => void;
  error: (title: string, detail?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: Tone, title: string, detail?: string) => {
      const id = (nextId += 1);
      setToasts((current) => [...current, { id, tone, title, detail }]);
      // Errors stay up longer, because they usually need reading rather than
      // just acknowledging
      setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4000);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (title, detail) => push('success', title, detail),
      error: (title, detail) => push('error', title, detail),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* aria-live so a screen reader hears the result of an action it cannot
          see happen. Errors assert, successes wait their turn */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
            className="shadow-pop pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg bg-surface px-3.5 py-3"
          >
            <span
              className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full"
              style={{
                backgroundColor: toast.tone === 'success' ? 'var(--ok-bg)' : 'var(--bad-bg)',
                color: toast.tone === 'success' ? 'var(--ok-fg)' : 'var(--bad-fg)',
              }}
              aria-hidden
            >
              {toast.tone === 'success' ? <Check className="size-3" /> : <AlertTriangle className="size-3" />}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{toast.title}</p>
              {toast.detail && <p className="mt-0.5 text-xs text-ink-subtle">{toast.detail}</p>}
            </div>

            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
              className="-mr-1 -mt-0.5 rounded p-1 text-ink-faint hover:bg-surface-muted hover:text-ink"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}

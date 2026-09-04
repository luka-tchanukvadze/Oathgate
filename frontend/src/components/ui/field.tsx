import { cn } from '@/lib/utils';

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-xs text-[var(--bad-fg)]">{error}</span>
      ) : (
        hint && <span className="mt-1.5 block text-xs text-ink-subtle">{hint}</span>
      )}
    </label>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-well border border-line bg-surface px-3 text-sm text-ink sm:h-9 sm:px-3',
        'placeholder:text-ink-subtle focus:border-accent focus:outline-none',
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-11 w-full rounded-well border border-line bg-surface px-3 text-sm text-ink sm:h-9 sm:px-3 focus:border-accent focus:outline-none',
        className,
      )}
      {...props}
    />
  );
}

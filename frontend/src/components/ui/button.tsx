'use client';

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover shadow-card',
  secondary: 'shadow-card bg-surface text-ink hover:bg-surface-muted',
  ghost: 'text-ink-muted hover:bg-surface-muted hover:text-ink',
  danger: 'shadow-card bg-surface text-[var(--bad-fg)] hover:bg-[var(--bad-bg)]',
};

// Taller on touch, denser from sm up. 28px is fine for a mouse and much too
// small for a thumb, and the primary actions here are all on mobile too
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-xs gap-1.5 sm:h-7 sm:px-2.5',
  md: 'h-11 px-4 text-sm gap-1.5 sm:h-8 sm:px-3.5',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-full font-medium transition-colors',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

import Link from 'next/link';
import { cn } from '@/lib/utils';

// Two blocks and the link between them. A chain, without drawing a literal
// chain, and it still reads at 24px where a padlock would just look like every
// other security product
//
// The second block is the accent and sits in front, so the eye reads an order:
// something goes in, something comes out
// compact drops the wordmark on the narrowest screens. The phone header has a
// menu button, a search button and an environment switch to fit as well, and
// the mark alone still says which product this is
export function Logo({
  className,
  href = '/',
  compact = false,
}: {
  className?: string;
  href?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn('inline-flex shrink-0 items-center gap-2.5', className)}
    >
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-xl bg-ink text-on-accent"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none">
          <rect
            x="3"
            y="3"
            width="8.5"
            height="8.5"
            rx="2.6"
            fill="currentColor"
            opacity="0.85"
          />
          <path
            d="M11.5 7.25h3.1A2.4 2.4 0 0 1 17 9.65v3.1"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            opacity="0.45"
          />
          <rect
            x="12.5"
            y="12.5"
            width="8.5"
            height="8.5"
            rx="2.6"
            fill="var(--accent)"
          />
        </svg>
      </span>
      <span
        className={cn(
          'text-[19px] font-semibold tracking-[-0.02em] text-ink',
          compact && 'hidden sm:inline',
        )}
      >
        Oathgate
      </span>
    </Link>
  );
}

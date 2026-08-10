import Link from 'next/link';
import { cn } from '@/lib/utils';

// Two blocks and the link between them. A chain, without drawing a literal
// chain, and it still reads at 24px where a padlock would just look like every
// other security product
export function Logo({ className, href = '/' }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn('inline-flex shrink-0 items-center gap-2.5', className)}>
      <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-ink text-on-accent">
        <svg viewBox="0 0 24 24" className="size-4" fill="none">
          <rect x="3" y="3" width="8" height="8" rx="2.2" fill="currentColor" />
          <rect x="13" y="13" width="8" height="8" rx="2.2" fill="var(--accent)" />
          <path
            d="M11.5 7h3.2A2.3 2.3 0 0 1 17 9.3v3.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.55"
          />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-ink">Oathgate</span>
    </Link>
  );
}

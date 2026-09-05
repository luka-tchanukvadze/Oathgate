import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// The mark is a single colour with a transparent background, so on the dark
// hero it inverts to white rather than needing a second file
// brightness-0 crushes every pixel to black and invert flips it, which turns
// any one-colour artwork white without touching the alpha channel

// compact drops the wordmark on the narrowest screens. The phone header has a
// menu button, a search button and an environment switch to fit as well, and
// the mark alone still says which product this is
export function Logo({
  className,
  href = '/',
  compact = false,
  onDark = false,
}: {
  className?: string;
  href?: string;
  compact?: boolean;
  onDark?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label="Oathgate"
      className={cn('inline-flex shrink-0 items-center gap-2.5', className)}
    >
      <Image
        src="/logo.png"
        alt=""
        width={521}
        height={657}
        priority
        className={cn('h-9 w-auto shrink-0', onDark && 'brightness-0 invert')}
      />
      <span
        className={cn(
          'text-[19px] font-semibold tracking-[-0.02em]',
          onDark ? 'text-white' : 'text-ink',
          compact && 'hidden sm:inline',
        )}
      >
        Oathgate
      </span>
    </Link>
  );
}

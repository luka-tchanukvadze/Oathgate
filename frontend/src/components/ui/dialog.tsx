'use client';

import { useCallback, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const trap = useCallback((event: KeyboardEvent) => {
    if (event.key !== 'Tab' || !panelRef.current) return;

    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (element) => element.offsetParent !== null,
    );
    if (items.length === 0) return;

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    // Tab off the end wraps to the start and vice versa, so focus can never
    // escape into the page behind the dialog
    if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    // Remember what opened this so focus can go back there on close, otherwise
    // a keyboard user is dumped at the top of the document
    returnFocusRef.current = document.activeElement as HTMLElement | null;

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      trap(event);
    }

    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const firstField = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    firstField?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus?.();
    };
  }, [open, onClose, trap]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-[#0a2540]/45" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'shadow-pop relative z-10 max-h-[92dvh] w-full overflow-y-auto rounded-t-tile bg-surface sm:max-w-lg sm:rounded-tile',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
            {description && <p className="mt-1 text-sm text-ink-subtle">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 -mt-1.5 grid size-9 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-surface-muted hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from './toast';

export function CopyButton({ value, label, className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard needs a secure context, so this fails on plain http. Say so
      // rather than looking like nothing happened
      toast.error('Could not copy', 'Your browser blocked clipboard access on this page');
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label ?? 'Copy to clipboard'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-ink-subtle transition-colors hover:bg-surface-muted hover:text-ink',
        className,
      )}
    >
      {copied ? <Check className="size-3.5 text-accent" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {copied ? 'Copied' : (label ?? 'Copy')}
    </button>
  );
}

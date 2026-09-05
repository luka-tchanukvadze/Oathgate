'use client';

import { CopyButton } from './copy-button';
import { CodeBlock } from './code-block';

// Stripe puts the raw object next to every screen, which is the single cheapest
// thing I can do for a backend reviewer. This renders as text, never as HTML,
// so nothing in a payload can inject markup
export function JsonBlock({ value, title }: { value: unknown; title?: string }) {
  const text = JSON.stringify(value, null, 2);
  return (
    <div className="overflow-hidden rounded-well border border-line bg-surface-muted">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="text-xs font-medium text-ink-subtle">{title ?? 'Raw JSON'}</span>
        <CopyButton value={text} />
      </div>
      <div className="scrollbar-thin max-h-80 overflow-y-auto px-3 py-3">
        <CodeBlock code={text} className="text-ink" />
      </div>
    </div>
  );
}

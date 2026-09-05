import { cn } from '@/lib/utils';
import { CodeBlock } from './code-block';

// Stripe's empty states teach instead of apologising, and the developer-facing
// ones carry the call that makes them not empty. Costs nothing and it is the
// first thing an engineer reviewing this will try
export function EmptyState({
  title,
  description,
  action,
  code,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  code?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-6 py-14 text-center', className)}>
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="max-w-md text-sm text-ink-subtle">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
      {code && (
        <div className="mt-5 w-full max-w-xl rounded-well bg-surface-muted p-3.5 text-left">
          <CodeBlock code={code} className="text-ink-muted" />
        </div>
      )}
    </div>
  );
}

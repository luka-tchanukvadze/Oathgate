import { cn } from '@/lib/utils';

// The tile everything on a dashboard screen sits in. Same radius and the same
// padding as a Card, and a deeper shadow, because these read as blocks in a
// grid rather than as one sheet of content
export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <section className={cn('shadow-tile rounded-tile bg-surface', className)} {...props} />;
}

export function PanelHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6', className)}
      {...props}
    />
  );
}

export function PanelTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-[15px] font-semibold tracking-tight text-ink', className)} {...props} />;
}

export function PanelBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-5 sm:px-6', className)} {...props} />;
}

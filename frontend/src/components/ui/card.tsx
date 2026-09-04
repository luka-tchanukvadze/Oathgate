import { cn } from '@/lib/utils';

// White card on a grey canvas, held by an almost invisible shadow rather than a
// hard border. That is what makes a dense table feel calm
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('shadow-card rounded-card bg-surface', className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6', className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-[15px] font-semibold tracking-tight text-ink', className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-5 sm:px-6', className)} {...props} />;
}

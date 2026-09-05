import { cn } from '@/lib/utils';

// Code wraps rather than scrolling sideways
// A horizontal scrollbar hides the end of the line, and the end of the line is
// where the interesting part usually is: the argument, the comparison, the
// address. Nobody drags a code sample sideways to find it

// A wrapped line is indented under the one it belongs to, so it cannot be read
// as the next statement. Each line has to be its own block for that, because a
// negative text-indent moves only the first line of a block and pre-wrap makes
// the whole snippet one block
export function CodeBlock({ code, className }: { code: string; className?: string }) {
  return (
    <code className={cn('mono block text-xs leading-relaxed', className)}>
      {code.split('\n').map((line, index) => (
        <span
          key={index}
          className="block -indent-5 whitespace-pre-wrap pl-5 wrap-break-word"
        >
          {/* A blank line has no height of its own once it is a block */}
          {line || ' '}
        </span>
      ))}
    </code>
  );
}

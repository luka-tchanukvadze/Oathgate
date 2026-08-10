import type { PaymentStatus } from '@/types';

// The payment state machine, with wherever this payment currently sits lit up
//
// Worth drawing rather than listing, because the shape is the point: settlement
// forks two ways, expiry is a dead end, and REVERSED hangs off PAID rather than
// replacing it, which is exactly why a reversal writes a compensating pair
// instead of editing the original

interface Node {
  status: PaymentStatus;
  label: string;
  x: number;
  y: number;
}

const W = 108;
const H = 30;

const NODES: Node[] = [
  { status: 'PENDING', label: 'Pending', x: 6, y: 12 },
  { status: 'CONFIRMING', label: 'Confirming', x: 148, y: 12 },
  { status: 'PAID', label: 'Paid', x: 290, y: 12 },
  { status: 'REVERSED', label: 'Reversed', x: 432, y: 12 },
  { status: 'EXPIRED', label: 'Expired', x: 6, y: 96 },
  { status: 'UNDERPAID', label: 'Underpaid', x: 148, y: 96 },
];

const TONE: Record<PaymentStatus, { fg: string; bg: string }> = {
  PENDING: { fg: 'var(--warn-fg)', bg: 'var(--warn-bg)' },
  CONFIRMING: { fg: 'var(--info-fg)', bg: 'var(--info-bg)' },
  PAID: { fg: 'var(--ok-fg)', bg: 'var(--ok-bg)' },
  UNDERPAID: { fg: 'var(--bad-fg)', bg: 'var(--bad-bg)' },
  EXPIRED: { fg: 'var(--neutral-fg)', bg: 'var(--neutral-bg)' },
  REVERSED: { fg: 'var(--special-fg)', bg: 'var(--special-bg)' },
  FAILED: { fg: 'var(--bad-fg)', bg: 'var(--bad-bg)' },
};

export function StateMachine({ current }: { current: PaymentStatus }) {
  return (
    <svg
      viewBox="0 0 546 140"
      className="h-auto w-full"
      role="img"
      aria-label={`Payment state machine, currently ${current.toLowerCase()}`}
    >
      <defs>
        <marker id="sm-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,1 L7,4 L0,7" fill="none" stroke="var(--line-strong)" strokeWidth="1.4" strokeLinecap="round" />
        </marker>
      </defs>

      <g stroke="var(--line-strong)" strokeWidth="1.4" markerEnd="url(#sm-arrow)" fill="none">
        <path d="M114,27 L146,27" />
        <path d="M256,27 L288,27" />
        <path d="M398,27 L430,27" />
        <path d="M60,42 L60,94" />
        <path d="M202,42 L202,94" />
      </g>

      {NODES.map((node) => {
        const active = node.status === current;
        const tone = TONE[node.status];
        return (
          <g key={node.status}>
            <rect
              x={node.x}
              y={node.y}
              width={W}
              height={H}
              rx="7"
              fill={active ? tone.bg : 'var(--surface)'}
              stroke={active ? tone.fg : 'var(--line)'}
              strokeWidth={active ? 1.6 : 1.2}
            />
            <text
              x={node.x + W / 2}
              y={node.y + H / 2 + 4}
              textAnchor="middle"
              fontSize="12"
              fontWeight={active ? 600 : 500}
              fill={active ? tone.fg : 'var(--ink-subtle)'}
            >
              {node.label}
            </text>
          </g>
        );
      })}

      <text x="216" y="72" fontSize="10" fill="var(--ink-faint)">
        short
      </text>
      <text x="74" y="72" fontSize="10" fill="var(--ink-faint)">
        nothing arrived
      </text>
      <text x="444" y="60" fontSize="10" fill="var(--ink-faint)">
        reorg
      </text>
    </svg>
  );
}

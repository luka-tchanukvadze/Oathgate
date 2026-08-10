'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatFiat, fiatDecimals } from '@/lib/format/money';

export interface VolumePoint {
  label: string;
  // Still minor units, still a string. The float only happens at the very last
  // step, below
  minor: string;
}

// Recharts plots numbers, so a chart is the one place a money value has to
// become a float. That is fine because this value is a pixel height and nothing
// reads it back: the tooltip and the axis both re-format from the original
// string. The rule is that the float never travels anywhere
function toPlotValue(minor: string, currency: string): number {
  const decimals = fiatDecimals(currency);
  return Number(minor) / 10 ** decimals;
}

export function VolumeChart({
  data,
  currency,
  height = 220,
}: {
  data: VolumePoint[];
  currency: string;
  height?: number;
}) {
  const points = data.map((point) => ({
    label: point.label,
    minor: point.minor,
    value: toPlotValue(point.minor, currency),
  }));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="volume-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />

          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--ink-faint)', fontSize: 11 }}
            minTickGap={24}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--ink-faint)', fontSize: 11 }}
            width={52}
            tickFormatter={(value: number) => (value >= 1000 ? `${Math.round(value / 1000)}k` : String(value))}
          />

          <Tooltip
            cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as (typeof points)[number];
              return (
                <div className="shadow-pop rounded-md bg-surface px-2.5 py-2">
                  <p className="text-2xs text-ink-faint">{point.label}</p>
                  {/* Formatted from the original minor-unit string, so what is
                      shown is exact even though the plotted height is not */}
                  <p className="num text-sm font-medium text-ink">
                    {formatFiat(point.minor, currency)} {currency}
                  </p>
                </div>
              );
            }}
          />

          <Area
            // Animation off, same as the donut. It made the first paint
            // non-deterministic, and a chart that sometimes renders empty is
            // worse than one that never animates
            isAnimationActive={false}
            type="monotone"
            dataKey="value"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#volume-fade)"
            dot={false}
            activeDot={{ r: 3.5, fill: 'var(--accent)', stroke: 'var(--surface)', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

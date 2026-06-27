"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export type LineSeries = {
  key: string;
  name: string;
  color?: string;
};

const PALETTE = ["#7c5cff", "#22d3ee", "#34d399", "#fbbf24", "#fb7185"];

// Format key kept as a string (not a function) so Server Components can pass it
// across the server/client boundary, which React forbids for raw functions.
export type YFormat = "number" | "compact" | "percent" | "currency";

export function makeYFormatter(fmt?: YFormat): ((v: number) => string) | undefined {
  switch (fmt) {
    case "compact":
      return (v) => Intl.NumberFormat("en", { notation: "compact" }).format(v);
    case "percent":
      return (v) => `${v}%`;
    case "currency":
      return (v) => `$${Intl.NumberFormat("en", { notation: "compact" }).format(v)}`;
    case "number":
      return (v) => Intl.NumberFormat("en").format(v);
    default:
      return undefined;
  }
}

export function LineChartCard({
  data,
  series,
  xKey = "label",
  height = 240,
  yFormat,
}: {
  data: Record<string, number | string>[];
  series: LineSeries[];
  xKey?: string;
  height?: number;
  yFormat?: YFormat;
}) {
  if (!data || data.length === 0) {
    return <ChartEmpty height={height} />;
  }
  const yTickFormatter = makeYFormatter(yFormat);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fill: "#64748b", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
            minTickGap={24}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={yTickFormatter}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "#e2e8f0", fontSize: 12 }}
            itemStyle={{ fontSize: 12 }}
            cursor={{ stroke: "rgba(124,92,255,0.3)" }}
          />
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color ?? PALETTE[i % PALETTE.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export const tooltipStyle: React.CSSProperties = {
  background: "#11182e",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  boxShadow: "0 12px 40px -12px rgba(0,0,0,0.6)",
};

export function ChartEmpty({ height = 240 }: { height?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] text-sm text-slate-500"
      style={{ height }}
    >
      No data to chart yet
    </div>
  );
}

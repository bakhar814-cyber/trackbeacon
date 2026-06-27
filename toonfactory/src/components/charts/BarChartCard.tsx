"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { ChartEmpty, tooltipStyle, makeYFormatter, type YFormat } from "./LineChartCard";

const PALETTE = ["#7c5cff", "#22d3ee", "#34d399", "#fbbf24", "#fb7185", "#a78bff"];

export function BarChartCard({
  data,
  xKey = "label",
  yKey = "value",
  height = 240,
  color = "#7c5cff",
  multicolor = false,
  yFormat,
  horizontal = false,
}: {
  data: Record<string, number | string>[];
  xKey?: string;
  yKey?: string;
  height?: number;
  color?: string;
  multicolor?: boolean;
  yFormat?: YFormat;
  horizontal?: boolean;
}) {
  if (!data || data.length === 0) {
    return <ChartEmpty height={height} />;
  }
  const yTickFormatter = makeYFormatter(yFormat);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 8, right: 12, left: horizontal ? 12 : 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={horizontal} horizontal={!horizontal} />
          {horizontal ? (
            <>
              <XAxis
                type="number"
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={yTickFormatter}
              />
              <YAxis
                type="category"
                dataKey={xKey}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={96}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={xKey}
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                minTickGap={8}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={yTickFormatter}
              />
            </>
          )}
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "#e2e8f0", fontSize: 12 }}
            itemStyle={{ fontSize: 12 }}
            cursor={{ fill: "rgba(124,92,255,0.08)" }}
          />
          <Bar dataKey={yKey} radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]} maxBarSize={48}>
            {data.map((_, i) => (
              <Cell key={i} fill={multicolor ? PALETTE[i % PALETTE.length] : color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

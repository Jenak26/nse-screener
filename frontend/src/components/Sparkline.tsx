import { LineChart, Line, Tooltip, ResponsiveContainer } from "recharts";
import type { MetricPoint } from "../types/stock";

interface Props { data: MetricPoint[]; color?: string; label: string; suffix?: string; }

export function Sparkline({ data, color = "#3b82f6", label, suffix = "" }: Props) {
  if (!data || data.length < 2) return null;
  return (
    <div className="mt-3 bg-slate-50 rounded-xl p-3">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">{label} trend</p>
      <ResponsiveContainer width="100%" height={64}>
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
          />
          <Tooltip
            formatter={(v: number) => [`${v.toFixed(1)}${suffix}`, label]}
            labelFormatter={(l) => String(l)}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex justify-between text-xs text-slate-400 mt-1">
        <span>{data[0].quarter}</span>
        <span>{data[data.length - 1].quarter}</span>
      </div>
    </div>
  );
}

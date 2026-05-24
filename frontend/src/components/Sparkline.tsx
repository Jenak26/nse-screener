import { LineChart, Line, Tooltip, ResponsiveContainer } from "recharts";
import type { MetricPoint } from "../types/stock";

interface Props { data: MetricPoint[]; color?: string; label: string; suffix?: string; }

export function Sparkline({ data, color = "#3b82f6", label, suffix = "" }: Props) {
  if (!data || data.length < 2) return null;
  return (
    <div className="mt-3 bg-white/5 border border-white/10 rounded-xl p-3">
      <p className="text-xs font-medium text-white/40 uppercase tracking-wide mb-2">{label} trend</p>
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
            formatter={(v) => [`${Number(v).toFixed(1)}${suffix}`, label]}
            labelFormatter={(l) => String(l)}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(30,41,59,0.95)", color: "#e2e8f0" }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex justify-between text-xs text-white/30 mt-1">
        <span>{data[0].quarter}</span>
        <span>{data[data.length - 1].quarter}</span>
      </div>
    </div>
  );
}

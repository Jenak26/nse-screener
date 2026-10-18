import { LineChart, Line, Tooltip, ResponsiveContainer } from "recharts";
import type { MetricPoint } from "../types/stock";

interface Props { data: MetricPoint[]; color?: string; label: string; suffix?: string; }

export function Sparkline({ data, color = "#3b82f6", label, suffix = "" }: Props) {
  if (!data || data.length < 2) return null;
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label} trend</p>
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
      <div className="flex justify-between mt-1 text-[11px] text-slate-500">
        <span>{data[0].quarter}</span>
        <span>{data[data.length - 1].quarter}</span>
      </div>
    </div>
  );
}

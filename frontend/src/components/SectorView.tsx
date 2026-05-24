import { useSectors } from "../hooks/useStocks";

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full bg-white/[0.06] rounded-full h-1 mt-1.5">
      <div className={`h-1 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function SectorView() {
  const { data: sectors, isLoading } = useSectors();

  if (isLoading) return (
    <div className="px-4 py-4 space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-14 bg-white/[0.06] rounded-xl animate-pulse" />
      ))}
    </div>
  );

  const maxRoe = Math.max(...(sectors ?? []).map((s) => s.avg_roe ?? 0));
  const maxPe = Math.max(...(sectors ?? []).map((s) => s.avg_pe ?? 0));

  return (
    <div className="px-4 pt-3 pb-8">
      <h2 className="text-[13px] font-semibold text-white/50 mb-3 uppercase tracking-[1.5px]">Sector Overview</h2>
      <div className="bg-[rgba(28,28,30,0.72)] backdrop-blur-2xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.25)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.07]">
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-[1.5px]">Sector</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-[1.5px]">Stocks</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-[1.5px] w-48">Avg ROE</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-[1.5px] w-48">Avg P/E</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-[1.5px]">Avg D/E</th>
            </tr>
          </thead>
          <tbody>
            {(sectors ?? []).map((s) => (
              <tr key={s.sector} className="border-b border-white/[0.05] hover:bg-white/[0.04] transition-colors last:border-0">
                <td className="px-4 py-3 font-medium text-white/80 text-[13px]">{s.sector}</td>
                <td className="px-4 py-3 text-white/40 text-[13px]">{s.stock_count}</td>
                <td className="px-4 py-3">
                  <span className="text-emerald-400 text-[13px] font-medium">{s.avg_roe?.toFixed(1) ?? "—"}%</span>
                  {s.avg_roe != null && <Bar value={s.avg_roe} max={maxRoe} color="bg-emerald-400/60" />}
                </td>
                <td className="px-4 py-3">
                  <span className="text-blue-400 text-[13px] font-medium">{s.avg_pe?.toFixed(1) ?? "—"}</span>
                  {s.avg_pe != null && <Bar value={s.avg_pe} max={maxPe} color="bg-blue-400/60" />}
                </td>
                <td className="px-4 py-3 text-white/40 text-[13px]">{s.avg_debt_to_equity?.toFixed(2) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

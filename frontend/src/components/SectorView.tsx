import { useSectors } from "../hooks/useStocks";

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full bg-white/10 rounded-full h-1.5 mt-1">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function SectorView() {
  const { data: sectors, isLoading } = useSectors();

  if (isLoading) return (
    <div className="space-y-3 p-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-16 bg-white/10 rounded-xl animate-pulse" />
      ))}
    </div>
  );

  const maxRoe = Math.max(...(sectors ?? []).map((s) => s.avg_roe ?? 0));
  const maxPe = Math.max(...(sectors ?? []).map((s) => s.avg_pe ?? 0));

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-white/90 mb-4">Sector Overview</h2>
      <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden shadow-xl shadow-black/20">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wide">Sector</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wide">Stocks</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wide w-48">Avg ROE</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wide w-48">Avg P/E</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wide">Avg D/E</th>
            </tr>
          </thead>
          <tbody>
            {(sectors ?? []).map((s) => (
              <tr key={s.sector} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 font-medium text-white/90">{s.sector}</td>
                <td className="px-4 py-3 text-white/50">{s.stock_count}</td>
                <td className="px-4 py-3">
                  <span className="text-emerald-400 font-medium">{s.avg_roe?.toFixed(1) ?? "—"}%</span>
                  {s.avg_roe != null && <Bar value={s.avg_roe} max={maxRoe} color="bg-emerald-400/70" />}
                </td>
                <td className="px-4 py-3">
                  <span className="text-blue-400 font-medium">{s.avg_pe?.toFixed(1) ?? "—"}</span>
                  {s.avg_pe != null && <Bar value={s.avg_pe} max={maxPe} color="bg-blue-400/70" />}
                </td>
                <td className="px-4 py-3 text-white/50">{s.avg_debt_to_equity?.toFixed(2) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

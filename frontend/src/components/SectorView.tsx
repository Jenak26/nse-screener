import { useSectors } from "../hooks/useStocks";
import type { Sector } from "../types/stock";

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(0, Math.min((value / max) * 100, 100)) : 0;
  return (
    <div className="mt-1.5 h-1 w-full rounded-full bg-white/[0.06]" aria-hidden>
      <div className={`h-1 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

const f = (v: number | null, d = 1, suffix = "") => (v != null ? `${v.toFixed(d)}${suffix}` : "—");

interface Props {
  onSelect: (sector: string) => void;
}

export function SectorView({ onSelect }: Props) {
  const { data, isLoading } = useSectors();

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/[0.05]" />
        ))}
      </div>
    );
  }

  const sectors: Sector[] = [...(data ?? [])].sort((a, b) => b.stock_count - a.stock_count);
  const maxRoe = Math.max(0, ...sectors.map((s) => s.avg_roe ?? 0));
  const maxPe = Math.max(0, ...sectors.map((s) => s.avg_pe ?? 0));

  return (
    <section aria-labelledby="sectors-h">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <h2 id="sectors-h" className="text-lg font-semibold tracking-tight text-white">Sector overview</h2>
        <p className="text-xs text-slate-400">Averages across NIFTY 500 constituents. Select a sector to screen it.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sectors.map((s) => (
          <li key={s.sector}>
            <button
              onClick={() => onSelect(s.sector)}
              className="panel group block w-full p-4 text-left transition-colors hover:border-emerald-400/30 hover:bg-white/[0.04]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium text-slate-100">{s.sector}</span>
                <span className="num shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-slate-300">
                  {s.stock_count} {s.stock_count === 1 ? "stock" : "stocks"}
                </span>
              </div>
              <dl className="num mt-4 grid grid-cols-3 gap-3 text-xs">
                <div>
                  <dt className="text-slate-500">Avg ROE</dt>
                  <dd className="mt-0.5 font-semibold text-emerald-300">{f(s.avg_roe, 1, "%")}</dd>
                  {s.avg_roe != null && <Bar value={s.avg_roe} max={maxRoe} color="bg-emerald-400/70" />}
                </div>
                <div>
                  <dt className="text-slate-500">Avg P/E</dt>
                  <dd className="mt-0.5 font-semibold text-sky-300">{f(s.avg_pe)}</dd>
                  {s.avg_pe != null && <Bar value={s.avg_pe} max={maxPe} color="bg-sky-400/70" />}
                </div>
                <div>
                  <dt className="text-slate-500">Avg D/E</dt>
                  <dd className="mt-0.5 font-semibold text-slate-200">{f(s.avg_debt_to_equity, 2)}</dd>
                </div>
              </dl>
              <span className="mt-3 block text-[11px] text-slate-500 transition-colors group-hover:text-emerald-300">
                Screen this sector →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

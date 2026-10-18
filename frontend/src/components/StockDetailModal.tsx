import { useEffect, useRef } from "react";
import { useStockDetail } from "../hooks/useStocks";
import { fmt, fmtCap, fmtPrice, ordinal } from "../lib/format";
import { Sparkline } from "./Sparkline";

interface Props {
  symbol: string;
  onClose: () => void;
}

// Percentiles from the API are already oriented so that higher = better within the sector
// (P/E and D/E are inverted server-side).
function tone(p: number) {
  return p >= 66 ? ["bg-emerald-400", "text-emerald-300"] : p >= 33 ? ["bg-amber-400", "text-amber-300"] : ["bg-rose-400", "text-rose-300"];
}

function Metric({ label, value, percentile }: { label: string; value: string | null; percentile?: number | null }) {
  const [bar, text] = percentile != null ? tone(percentile) : ["", ""];
  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-slate-400">{label}</span>
        <span className="num text-sm font-semibold text-slate-100">{value ?? "—"}</span>
      </div>
      {percentile != null && (
        <div className="mt-2 flex items-center gap-3">
          <div
            className="h-1.5 flex-1 rounded-full bg-white/[0.07]"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentile}
            aria-label={`${label} sector percentile`}
          >
            <div className={`h-1.5 rounded-full ${bar}`} style={{ width: `${Math.max(percentile, 3)}%` }} />
          </div>
          <span className={`num w-28 text-right text-[11px] font-medium ${text}`}>{ordinal(percentile)} pct in sector</span>
        </div>
      )}
    </div>
  );
}

export function StockDetailModal({ symbol, onClose }: Props) {
  const { data, isLoading, isError } = useStockDetail(symbol);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = prev;
      opener?.focus?.();
    };
  }, [onClose]);

  const offHigh =
    data?.price != null && data.fifty_two_week_high ? ((data.price - data.fifty_two_week_high) / data.fifty_two_week_high) * 100 : null;
  const rank = data?.sector_rank;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-title"
        className="thin-scroll max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-white/10 bg-slate-900 shadow-[0_24px_64px_rgba(0,0,0,0.6)] sm:max-w-lg sm:rounded-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/[0.07] bg-slate-900/95 p-5 backdrop-blur">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="stock-title" className="text-xl font-bold tracking-tight text-white">{symbol}</h2>
              {data?.sector && (
                <span className="rounded-full border border-white/[0.08] bg-white/[0.05] px-2 py-0.5 text-[11px] text-slate-300">{data.sector}</span>
              )}
            </div>
            {data?.company_name && <p className="mt-0.5 truncate text-sm text-slate-400">{data.company_name}</p>}
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close details"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden>
              <path fill="currentColor" d="M5.3 5.3a1 1 0 011.4 0L10 8.6l3.3-3.3a1 1 0 111.4 1.4L11.4 10l3.3 3.3a1 1 0 01-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 01-1.4-1.4L8.6 10 5.3 6.7a1 1 0 010-1.4z" />
            </svg>
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-5">
            <div className="h-20 animate-pulse rounded-xl bg-white/[0.06]" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded-lg bg-white/[0.05]" />
            ))}
          </div>
        ) : isError || !data ? (
          <p className="p-8 text-center text-sm text-slate-400">Couldn't load {symbol}. It may not be in the NIFTY 500 snapshot.</p>
        ) : (
          <div className="p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Price</p>
                <p className="num mt-1 text-2xl font-bold tracking-tight text-white">{fmtPrice(data.price) ?? "—"}</p>
                {offHigh != null && (
                  <p className={`num mt-1 text-xs ${offHigh >= -5 ? "text-emerald-300" : "text-slate-400"}`}>
                    {offHigh >= -0.05 ? "At 52-week high" : `${Math.abs(offHigh).toFixed(1)}% below 52W high`}
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Market cap</p>
                <p className="num mt-1 text-2xl font-bold tracking-tight text-white">{fmtCap(data.market_cap) ?? "—"}</p>
                {data.fifty_two_week_high != null && (
                  <p className="num mt-1 text-xs text-slate-400">52W high {fmtPrice(data.fifty_two_week_high)}</p>
                )}
              </div>
            </div>

            <h3 className="mb-1 mt-6 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Fundamentals vs sector peers
            </h3>
            <div className="divide-y divide-white/[0.06]">
              <Metric label="P/E ratio" value={fmt(data.pe_ratio)} percentile={rank?.pe_percentile} />
              <Metric label="Return on equity" value={data.roe != null ? `${data.roe.toFixed(1)}%` : null} percentile={rank?.roe_percentile} />
              <Metric label="Debt / equity" value={data.debt_to_equity != null ? `${data.debt_to_equity.toFixed(2)}×` : null} percentile={rank?.debt_percentile} />
              <Metric label="Revenue growth (YoY)" value={data.revenue_growth_yoy != null ? `${data.revenue_growth_yoy.toFixed(1)}%` : null} percentile={rank?.revenue_growth_percentile} />
              <Metric label="Promoter holding" value={data.promoter_holding != null ? `${data.promoter_holding.toFixed(1)}%` : null} percentile={rank?.promoter_percentile} />
              {data.current_ratio != null && <Metric label="Current ratio" value={fmt(data.current_ratio, 2)} />}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Percentile bars are oriented so longer is better: a cheaper P/E or lower debt ranks higher.
            </p>

            {((data.history?.roe?.length ?? 0) >= 2 || (data.history?.pe_ratio?.length ?? 0) >= 2) && (
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {(data.history?.roe?.length ?? 0) >= 2 && <Sparkline data={data.history.roe} label="ROE" suffix="%" color="#34d399" />}
                {(data.history?.pe_ratio?.length ?? 0) >= 2 && <Sparkline data={data.history.pe_ratio} label="P/E" color="#38bdf8" />}
              </div>
            )}

            <a
              href={`https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(symbol)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-300"
            >
              View on NSE ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

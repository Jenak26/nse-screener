import { useEffect } from "react";
import { useStockDetail } from "../hooks/useStocks";
import { Sparkline } from "./Sparkline";

interface Props {
  symbol: string;
  onClose: () => void;
}

function Row({
  label, value, percentile, higherBetter = true,
}: {
  label: string;
  value: string | null;
  percentile?: number | null;
  higherBetter?: boolean;
}) {
  const pctColor =
    percentile == null ? "" :
    higherBetter
      ? percentile >= 66 ? "text-emerald-400" : percentile >= 33 ? "text-amber-400" : "text-red-400"
      : percentile <= 33 ? "text-emerald-400" : percentile <= 66 ? "text-amber-400" : "text-red-400";

  return (
    <div className="flex justify-between items-center py-2.5 border-b border-white/[0.07] last:border-0">
      <span className="text-[13px] text-white/45">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-[13px] font-medium text-white/85">{value ?? "—"}</span>
        {percentile != null && (
          <span className={`text-[11px] font-semibold ${pctColor}`}>
            {percentile}th pct
          </span>
        )}
      </div>
    </div>
  );
}

export function StockDetailModal({ symbol, onClose }: Props) {
  const { data, isLoading } = useStockDetail(symbol);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const f = (v: number | null | undefined, suffix = "", d = 1) =>
    v != null ? `${v.toFixed(d)}${suffix}` : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[rgba(28,28,30,0.92)] backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.6)] w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start p-5 border-b border-white/[0.07]">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">{symbol}</h2>
            {data && (
              <>
                <p className="text-[13px] text-white/45 mt-0.5">{data.company_name}</p>
                <span className="inline-block mt-2 px-2.5 py-0.5 text-xs rounded-full bg-white/[0.07] text-white/45 border border-white/[0.07]">
                  {data.sector}
                </span>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/25 hover:text-white/60 text-xl leading-none p-1 transition-colors"
          >
            ✕
          </button>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-7 bg-white/[0.06] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : data ? (
          <div className="p-5">
            {data.price != null && (
              <div className="mb-5 p-4 bg-white/[0.04] rounded-xl border border-white/[0.07]">
                <p className="text-2xl font-bold text-white tracking-tight">
                  ₹{data.price.toFixed(2)}
                </p>
                {data.fifty_two_week_high != null && (
                  <p className="text-[11px] text-white/30 mt-1">
                    52W High: ₹{data.fifty_two_week_high.toFixed(2)}
                  </p>
                )}
              </div>
            )}
            <Row label="P/E Ratio" value={f(data.pe_ratio)} percentile={data.sector_rank?.pe_percentile} higherBetter={false} />
            <Row label="ROE" value={f(data.roe, "%")} percentile={data.sector_rank?.roe_percentile} />
            <Row label="Debt / Equity" value={f(data.debt_to_equity, "", 2)} percentile={data.sector_rank?.debt_percentile} higherBetter={false} />
            <Row label="Revenue Growth (YoY)" value={f(data.revenue_growth_yoy, "%")} percentile={data.sector_rank?.revenue_growth_percentile} />
            <Row label="Promoter Holding" value={f(data.promoter_holding, "%")} percentile={data.sector_rank?.promoter_percentile} />
            <Row label="Current Ratio" value={f(data.current_ratio)} />
            <Row label="Market Cap" value={data.market_cap ? `₹${(data.market_cap / 1000).toFixed(1)}K Cr` : null} />
            {(data.history?.roe?.length ?? 0) >= 2 && (
              <Sparkline data={data.history.roe} label="ROE" suffix="%" color="#34d399" />
            )}
            {(data.history?.pe_ratio?.length ?? 0) >= 2 && (
              <Sparkline data={data.history.pe_ratio} label="P/E" color="#60a5fa" />
            )}
          </div>
        ) : (
          <p className="p-5 text-sm text-white/30 text-center">Failed to load stock data.</p>
        )}
      </div>
    </div>
  );
}

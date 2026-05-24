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
    percentile == null
      ? ""
      : higherBetter
      ? percentile >= 66
        ? "text-emerald-400"
        : percentile >= 33
        ? "text-amber-400"
        : "text-red-400"
      : percentile <= 33
      ? "text-emerald-400"
      : percentile <= 66
      ? "text-amber-400"
      : "text-red-400";

  return (
    <div className="flex justify-between items-center py-2.5 border-b border-white/10 last:border-0">
      <span className="text-sm text-white/50">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-white/90">{value ?? "—"}</span>
        {percentile != null && (
          <span className={`text-xs font-semibold ${pctColor}`}>
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-slate-800/80 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl shadow-black/50 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white">{symbol}</h2>
            {data && (
              <>
                <p className="text-sm text-white/50 mt-0.5">{data.company_name}</p>
                <span className="inline-block mt-2 px-2.5 py-0.5 text-xs rounded-full bg-white/10 text-white/60 border border-white/10">
                  {data.sector}
                </span>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/70 text-2xl leading-none p-1 transition-colors"
          >
            ×
          </button>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-8 bg-white/10 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : data ? (
          <div className="p-6">
            {data.price != null && (
              <div className="mb-5 p-4 bg-white/5 rounded-xl border border-white/10">
                <p className="text-2xl font-bold text-white">
                  ₹{data.price.toFixed(2)}
                </p>
                {data.fifty_two_week_high != null && (
                  <p className="text-xs text-white/40 mt-1">
                    52W High: ₹{data.fifty_two_week_high.toFixed(2)}
                  </p>
                )}
              </div>
            )}
            <Row
              label="P/E Ratio"
              value={f(data.pe_ratio)}
              percentile={data.sector_rank?.pe_percentile}
              higherBetter={false}
            />
            <Row
              label="ROE"
              value={f(data.roe, "%")}
              percentile={data.sector_rank?.roe_percentile}
            />
            <Row
              label="Debt / Equity"
              value={f(data.debt_to_equity, "", 2)}
              percentile={data.sector_rank?.debt_percentile}
              higherBetter={false}
            />
            <Row
              label="Revenue Growth (YoY)"
              value={f(data.revenue_growth_yoy, "%")}
              percentile={data.sector_rank?.revenue_growth_percentile}
            />
            <Row
              label="Promoter Holding"
              value={f(data.promoter_holding, "%")}
              percentile={data.sector_rank?.promoter_percentile}
            />
            <Row label="Current Ratio" value={f(data.current_ratio)} />
            <Row
              label="Market Cap"
              value={
                data.market_cap
                  ? `₹${(data.market_cap / 1000).toFixed(1)}K Cr`
                  : null
              }
            />
            {(data.history?.roe?.length ?? 0) >= 2 && (
              <Sparkline data={data.history.roe} label="ROE" suffix="%" color="#16a34a" />
            )}
            {(data.history?.pe_ratio?.length ?? 0) >= 2 && (
              <Sparkline data={data.history.pe_ratio} label="P/E" color="#3b82f6" />
            )}
          </div>
        ) : (
          <p className="p-6 text-sm text-white/40 text-center">
            Failed to load stock data.
          </p>
        )}
      </div>
    </div>
  );
}

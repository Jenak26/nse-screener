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
        ? "text-emerald-600"
        : percentile >= 33
        ? "text-amber-500"
        : "text-red-500"
      : percentile <= 33
      ? "text-emerald-600"
      : percentile <= 66
      ? "text-amber-500"
      : "text-red-500";

  return (
    <div className="flex justify-between items-center py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-800">{value ?? "—"}</span>
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start p-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{symbol}</h2>
            {data && (
              <>
                <p className="text-sm text-slate-500 mt-0.5">{data.company_name}</p>
                <span className="inline-block mt-2 px-2.5 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
                  {data.sector}
                </span>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none p-1"
          >
            ×
          </button>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-8 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : data ? (
          <div className="p-6">
            {data.price != null && (
              <div className="mb-5 p-4 bg-slate-50 rounded-xl">
                <p className="text-2xl font-bold text-slate-900">
                  ₹{data.price.toFixed(2)}
                </p>
                {data.fifty_two_week_high != null && (
                  <p className="text-xs text-slate-400 mt-1">
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
          <p className="p-6 text-sm text-slate-400 text-center">
            Failed to load stock data.
          </p>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FilterPanel } from "./components/FilterPanel";
import { StockTable } from "./components/StockTable";
import { StockDetailModal } from "./components/StockDetailModal";
import { SectorView } from "./components/SectorView";
import { PresetBar } from "./components/PresetBar";
import { useMeta, useSectors, useStocks } from "./hooks/useStocks";
import type { Filters } from "./types/stock";

const queryClient = new QueryClient();

const DEFAULT_FILTERS: Filters = {
  sector: "",
  pe_min: "",
  pe_max: "",
  roe_min: "",
  debt_max: "",
  revenue_growth_min: "",
  promoter_min: "",
};

function Screener() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState("market_cap");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"screener" | "sectors">("screener");

  const { data, isLoading } = useStocks(filters, sortBy, sortDir, page);
  const { data: sectors } = useSectors();
  const { data: meta } = useMeta();

  const handleSort = (col: string) => {
    if (col === sortBy) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortBy(col);
      setSortDir("desc");
    }
    setPage(1);
  };

  const handleFilters = (f: Filters) => {
    setFilters(f);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="sticky top-3 z-40 px-4">
        <header className="bg-[rgba(28,28,30,0.82)] backdrop-blur-2xl backdrop-saturate-200 border border-white/10 rounded-2xl h-[54px] flex items-center px-5 gap-3 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="flex items-baseline gap-2">
            <h1 className="text-[15px] font-bold text-white tracking-tight">NSE Screener</h1>
            <span className="text-[9px] text-white/30 font-semibold uppercase tracking-[1.8px]">NIFTY 500</span>
          </div>
          <nav className="flex gap-0.5 ml-5 bg-white/[0.07] rounded-[10px] p-[3px] border border-white/[0.06]">
            {(["screener", "sectors"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-[5px] text-xs rounded-lg font-medium capitalize transition-all ${
                  tab === t
                    ? "bg-white/[0.14] text-white shadow-[0_1px_4px_rgba(0,0,0,0.3)]"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4 text-[11px] text-white/[0.22]">
            {meta?.total_stocks ? <span>{meta.total_stocks.toLocaleString()} stocks</span> : null}
            {meta?.last_updated ? (
              <span>{new Date(meta.last_updated).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
            ) : null}
            {meta?.pipeline_status === "empty" && (
              <span className="text-amber-400 font-medium">Run pipeline to populate data</span>
            )}
          </div>
        </header>
      </div>

      {tab === "screener" && (
        <PresetBar
          currentFilters={filters}
          defaultFilters={DEFAULT_FILTERS}
          onApply={handleFilters}
        />
      )}

      {tab === "screener" ? (
        <div className="flex gap-4 px-4 pt-3 pb-8">
          <FilterPanel
            filters={filters}
            sectors={(sectors ?? []).map((s) => s.sector)}
            onChange={handleFilters}
            onReset={() => { setFilters(DEFAULT_FILTERS); setPage(1); }}
          />
          <main className="flex-1 min-w-0">
            <StockTable
              stocks={data?.stocks ?? []}
              total={data?.total ?? 0}
              page={page}
              pageSize={20}
              sortBy={sortBy}
              sortDir={sortDir}
              isLoading={isLoading}
              onSort={handleSort}
              onPage={setPage}
              onRowClick={setSelected}
            />
          </main>
        </div>
      ) : (
        <SectorView />
      )}

      {selected && <StockDetailModal symbol={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Screener />
    </QueryClientProvider>
  );
}

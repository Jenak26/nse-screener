import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FilterPanel } from "./components/FilterPanel";
import { StockTable } from "./components/StockTable";
import { StockDetailModal } from "./components/StockDetailModal";
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
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 h-[57px] flex items-center px-6 gap-3">
        <div className="flex items-baseline gap-2">
          <h1 className="text-base font-bold text-slate-900 tracking-tight">
            NSE Screener
          </h1>
          <span className="text-xs text-slate-400 font-medium">NIFTY 500</span>
        </div>
        <div className="ml-auto flex items-center gap-4 text-xs text-slate-400">
          {meta?.total_stocks ? (
            <span>{meta.total_stocks.toLocaleString()} stocks</span>
          ) : null}
          {meta?.last_updated ? (
            <span>
              Updated{" "}
              {new Date(meta.last_updated).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          ) : null}
          {meta?.pipeline_status === "empty" && (
            <span className="text-amber-500 font-medium">
              Run pipeline to populate data
            </span>
          )}
        </div>
      </header>

      <div className="flex">
        <FilterPanel
          filters={filters}
          sectors={(sectors ?? []).map((s) => s.sector)}
          onChange={handleFilters}
          onReset={() => {
            setFilters(DEFAULT_FILTERS);
            setPage(1);
          }}
        />
        <main className="flex-1 p-6 min-w-0">
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

      {selected && (
        <StockDetailModal symbol={selected} onClose={() => setSelected(null)} />
      )}
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

import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Header } from "./components/Header";
import { FilterPanel } from "./components/FilterPanel";
import { ActiveFilters } from "./components/ActiveFilters";
import { StockTable } from "./components/StockTable";
import { SectorView } from "./components/SectorView";
import { PresetBar } from "./components/PresetBar";
import { Footer } from "./components/Footer";
import { useMeta, useSectors, useStocks } from "./hooks/useStocks";
import { useDebounced } from "./hooks/useDebounced";
import { readUrlState, useSyncUrl, type Tab } from "./hooks/useUrlState";
import { fetchAllStocks } from "./lib/api";
import { downloadCsv } from "./lib/csv";
import { countActive, DEFAULT_FILTERS } from "./lib/filters";
import type { Filters } from "./types/stock";

// Free-tier backends sleep when idle; keep retrying long enough (~45s) to ride out a cold start.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 6,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      refetchOnWindowFocus: false,
    },
  },
});

const PAGE_SIZE = 20;

// The detail modal pulls in Recharts; load it on first open to keep the initial bundle small.
const StockDetailModal = lazy(() =>
  import("./components/StockDetailModal").then((m) => ({ default: m.StockDetailModal })),
);

function ServerStatusBanner({ isLoading, isError, onRetry }: {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!isLoading) return;
    const t = setTimeout(() => setSlow(true), 3000);
    return () => {
      clearTimeout(t);
      setSlow(false);
    };
  }, [isLoading]);

  if (isError) {
    return (
      <div role="alert" className="flex items-center gap-3 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200">
        <span>Couldn't reach the data server.</span>
        <button onClick={onRetry} className="ml-auto rounded-lg bg-white/10 px-3 py-1 font-medium text-white hover:bg-white/20">
          Retry
        </button>
      </div>
    );
  }
  if (slow && isLoading) {
    return (
      <div role="status" className="flex items-center gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-300/30 border-t-amber-300" aria-hidden />
        Waking up the data server. On free hosting this can take up to a minute.
      </div>
    );
  }
  return null;
}

function ExportButton({ filters, sortBy, sortDir, disabled }: { filters: Filters; sortBy: string; sortDir: string; disabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const rows = await fetchAllStocks(filters, sortBy, sortDir);
      downloadCsv(rows, `nse-screener-${new Date().toISOString().slice(0, 10)}.csv`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      onClick={run}
      disabled={disabled || busy}
      className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-medium text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
    >
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden>
        <path fill="currentColor" d="M10 3a1 1 0 011 1v7.6l2.3-2.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L9 11.6V4a1 1 0 011-1zM4 15a1 1 0 011 1h10a1 1 0 112 0 2 2 0 01-2 2H5a2 2 0 01-2-2 1 1 0 011-1z" />
      </svg>
      {busy ? "Exporting…" : "CSV"}
    </button>
  );
}

function Screener() {
  const [initial] = useState(readUrlState);
  const [filters, setFilters] = useState<Filters>(initial.filters);
  const [sortBy, setSortBy] = useState(initial.sortBy);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initial.sortDir);
  const [page, setPage] = useState(initial.page);
  const [tab, setTab] = useState<Tab>(initial.tab);
  const [selected, setSelected] = useState<string | null>(initial.stock);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Inputs update instantly; the API only sees values once typing pauses.
  const query = useDebounced(filters, 300);

  const { data, isLoading, isFetching, isError, refetch } = useStocks(query, sortBy, sortDir, page);
  const { data: sectors } = useSectors();
  const { data: meta } = useMeta();

  useSyncUrl({ filters: query, sortBy, sortDir, page, tab, stock: selected });

  const handleSort = (col: string) => {
    if (col === sortBy) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortBy(col);
      setSortDir(col === "symbol" || col === "sector" ? "asc" : "desc");
    }
    setPage(1);
  };

  const handleFilters = (f: Filters) => {
    setFilters(f);
    setPage(1);
  };

  const reset = () => handleFilters(DEFAULT_FILTERS);
  const resetScreen = () => handleFilters({ ...DEFAULT_FILTERS, q: filters.q });

  const handleQuery = (q: string) => {
    handleFilters({ ...filters, q });
    if (q) setTab("screener");
  };

  const handlePage = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeModal = useCallback(() => setSelected(null), []);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);
  const activeCount = countActive(filters);

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.07),transparent_55%)]">
      <Header tab={tab} onTab={setTab} query={filters.q} onQuery={handleQuery} meta={meta} />

      <div className="mx-auto w-full max-w-[1400px] flex-1 space-y-3 px-4 pb-10 pt-4">
        <ServerStatusBanner isLoading={isLoading} isError={isError && !data} onRetry={() => refetch()} />

        {tab === "screener" ? (
          <div className="flex gap-5">
            <FilterPanel
              filters={filters}
              sectors={(sectors ?? []).map((s) => s.sector).sort()}
              onChange={handleFilters}
              onReset={resetScreen}
              mobileOpen={filtersOpen}
              onMobileClose={closeFilters}
              resultCount={data?.total}
            />
            <main className="min-w-0 flex-1 space-y-3">
              <PresetBar currentFilters={filters} onApply={handleFilters} />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setFiltersOpen(true)}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-medium text-slate-200 hover:bg-white/[0.06] lg:hidden"
                >
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden>
                    <path fill="currentColor" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm2 5a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm3 5a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                  </svg>
                  Filters{activeCount > 0 && <span className="rounded-full bg-emerald-400/20 px-1.5 text-emerald-200">{activeCount}</span>}
                </button>
                <div className="min-w-0 flex-1">
                  <ActiveFilters filters={filters} onChange={handleFilters} onClear={reset} />
                </div>
                <ExportButton filters={query} sortBy={sortBy} sortDir={sortDir} disabled={!data?.total} />
              </div>
              <StockTable
                stocks={data?.stocks ?? []}
                total={data?.total ?? 0}
                page={page}
                pageSize={PAGE_SIZE}
                sortBy={sortBy}
                sortDir={sortDir}
                isLoading={isLoading}
                isFetching={isFetching}
                onSort={handleSort}
                onPage={handlePage}
                onRowClick={setSelected}
                onClearFilters={reset}
              />
            </main>
          </div>
        ) : (
          <SectorView
            onSelect={(sector) => {
              handleFilters({ ...DEFAULT_FILTERS, sector });
              setTab("screener");
              window.scrollTo({ top: 0 });
            }}
          />
        )}
      </div>

      <Footer meta={meta} />

      {selected && (
        <Suspense fallback={null}>
          <StockDetailModal symbol={selected} onClose={closeModal} />
        </Suspense>
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

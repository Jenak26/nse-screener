import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { Stock } from "../types/stock";
import { fmt, fmtCap, fmtPrice } from "../lib/format";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    numeric?: boolean;
    className?: string;
  }
}

const col = createColumnHelper<Stock>();

const dash = <span className="text-slate-600">—</span>;

function signed(v: number | null | undefined) {
  if (v == null) return dash;
  const cls = v > 0 ? "text-emerald-400" : v < 0 ? "text-rose-400" : "text-slate-400";
  return <span className={cls}>{v > 0 ? "+" : ""}{v.toFixed(1)}%</span>;
}

const plain = (v: string | null, cls = "text-slate-200") => (v == null ? dash : <span className={cls}>{v}</span>);

const COLUMNS = [
  col.accessor("symbol", {
    header: "Stock",
    cell: (i) => (
      <div className="min-w-0 max-w-[220px]">
        <div className="font-semibold text-white">{i.getValue()}</div>
        <div className="truncate text-xs text-slate-400" title={i.row.original.company_name ?? ""}>
          {i.row.original.company_name}
        </div>
      </div>
    ),
  }),
  col.accessor("sector", {
    header: "Sector",
    meta: { className: "hidden 2xl:table-cell" },
    cell: (i) =>
      i.getValue() ? (
        <span className="whitespace-nowrap rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-xs text-slate-300">
          {i.getValue()}
        </span>
      ) : dash,
  }),
  col.accessor("price", { header: "Price", meta: { numeric: true }, cell: (i) => plain(fmtPrice(i.getValue())) }),
  col.accessor("market_cap", { header: "Mkt cap", meta: { numeric: true }, cell: (i) => plain(fmtCap(i.getValue()), "text-slate-300") }),
  col.accessor("pe_ratio", { header: "P/E", meta: { numeric: true }, cell: (i) => plain(fmt(i.getValue())) }),
  col.accessor("roe", { header: "ROE", meta: { numeric: true }, cell: (i) => signed(i.getValue()) }),
  col.accessor("debt_to_equity", { header: "D/E", meta: { numeric: true }, cell: (i) => plain(fmt(i.getValue(), 2)) }),
  col.accessor("revenue_growth_yoy", { header: "Rev growth", meta: { numeric: true }, cell: (i) => signed(i.getValue()) }),
  col.accessor("promoter_holding", {
    header: "Promoter",
    meta: { numeric: true },
    cell: (i) => plain(i.getValue() != null ? `${i.getValue()!.toFixed(1)}%` : null),
  }),
];

const HEADER_TITLES: Record<string, string> = {
  pe_ratio: "Price to earnings (trailing)",
  roe: "Return on equity",
  debt_to_equity: "Debt to equity (×)",
  revenue_growth_yoy: "Revenue growth, year on year",
  promoter_holding: "Promoter group holding",
  market_cap: "Market capitalisation",
};

function SortIcon({ state }: { state: "asc" | "desc" | null }) {
  return (
    <svg viewBox="0 0 10 14" aria-hidden className="h-3 w-2.5 shrink-0">
      <path d="M5 1l4 5H1z" className={state === "asc" ? "fill-emerald-400" : "fill-slate-600"} />
      <path d="M5 13l4-5H1z" className={state === "desc" ? "fill-emerald-400" : "fill-slate-600"} />
    </svg>
  );
}

interface Props {
  stocks: Stock[];
  total: number;
  page: number;
  pageSize: number;
  sortBy: string;
  sortDir: "asc" | "desc";
  isLoading: boolean;
  isFetching: boolean;
  onSort: (col: string) => void;
  onPage: (p: number) => void;
  onRowClick: (symbol: string) => void;
  onClearFilters: () => void;
}

export function StockTable({
  stocks, total, page, pageSize, sortBy, sortDir,
  isLoading, isFetching, onSort, onPage, onRowClick, onClearFilters,
}: Props) {
  const table = useReactTable({
    data: stocks,
    columns: COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => Math.max(1, Math.min(page - 2, totalPages - 4)) + i);

  const pageBtn = "num h-8 min-w-8 rounded-lg border px-2.5 text-xs transition-colors disabled:pointer-events-none disabled:opacity-30";

  return (
    <div className="space-y-3">
      <div className={`panel overflow-hidden transition-opacity ${isFetching && !isLoading ? "opacity-70" : ""}`}>
        <div className="thin-scroll overflow-auto lg:max-h-[calc(100vh-230px)]">
          <table className="w-full text-sm">
            <caption className="sr-only">NIFTY 500 stocks matching the current filters. Select a row for details.</caption>
            <thead className="sticky top-0 z-10 bg-[#111827]">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-white/[0.08]">
                  {hg.headers.map((h) => {
                    const id = h.column.id;
                    const active = sortBy === id ? sortDir : null;
                    const meta = h.column.columnDef.meta;
                    return (
                      <th
                        key={h.id}
                        scope="col"
                        aria-sort={active === "asc" ? "ascending" : active === "desc" ? "descending" : "none"}
                        className={`px-3 py-2.5 font-normal first:pl-4 last:pr-4 ${meta?.className ?? ""}`}
                      >
                        <button
                          onClick={() => onSort(id)}
                          title={HEADER_TITLES[id]}
                          className={`inline-flex w-full items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                            meta?.numeric ? "justify-end" : ""
                          } ${active ? "text-emerald-300" : "text-slate-400 hover:text-slate-200"}`}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          <SortIcon state={active} />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.05]">
                    {COLUMNS.map((c, j) => (
                      <td key={j} className={`px-4 py-3.5 ${c.meta?.className ?? ""}`}>
                        <div className={`h-3.5 animate-pulse rounded bg-white/[0.07] ${j === 0 ? "w-24" : "ml-auto w-14"}`} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : stocks.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-16 text-center">
                    <p className="text-sm font-medium text-slate-200">No stocks match these filters</p>
                    <p className="mt-1 text-xs text-slate-400">Try loosening a threshold or clearing the search.</p>
                    <button onClick={onClearFilters} className="mt-4 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/[0.06]">
                      Clear all filters
                    </button>
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    onClick={() => onRowClick(row.original.symbol)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(row.original.symbol);
                      }
                    }}
                    aria-label={`${row.original.symbol}, ${row.original.company_name ?? ""}. Open details`}
                    className="cursor-pointer border-b border-white/[0.05] transition-colors last:border-0 hover:bg-white/[0.04] focus-visible:bg-white/[0.06] focus-visible:outline-none"
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta;
                      return (
                        <td key={cell.id} className={`px-3 py-2.5 first:pl-4 last:pr-4 ${meta?.numeric ? "num whitespace-nowrap text-right" : ""} ${meta?.className ?? ""}`}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {total > 0 && (
        <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="num text-xs text-slate-400">
            Showing <span className="text-slate-200">{from}–{to}</span> of <span className="text-slate-200">{total.toLocaleString()}</span>
          </p>
          {totalPages > 1 && (
            <div className="flex gap-1">
              <button onClick={() => onPage(page - 1)} disabled={page === 1} aria-label="Previous page" className={`${pageBtn} border-white/10 text-slate-300 hover:bg-white/[0.06]`}>
                ‹
              </button>
              {pages.map((p) => (
                <button
                  key={p}
                  onClick={() => onPage(p)}
                  aria-current={p === page ? "page" : undefined}
                  className={`${pageBtn} ${p === page ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200" : "border-white/10 text-slate-300 hover:bg-white/[0.06]"}`}
                >
                  {p}
                </button>
              ))}
              <button onClick={() => onPage(page + 1)} disabled={page === totalPages} aria-label="Next page" className={`${pageBtn} border-white/10 text-slate-300 hover:bg-white/[0.06]`}>
                ›
              </button>
            </div>
          )}
        </nav>
      )}
    </div>
  );
}

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { Stock } from "../types/stock";

const col = createColumnHelper<Stock>();

const dash = <span className="text-white/20">—</span>;

function fmt(v: number | null | undefined, d = 1) {
  return v != null ? v.toFixed(d) : dash;
}

function pctCell(v: number | null | undefined) {
  if (v == null) return dash;
  const cls = v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-white/30";
  return <span className={cls}>{v.toFixed(1)}%</span>;
}

function capCell(v: number | null | undefined) {
  if (v == null) return dash;
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(1)}L Cr`;
  if (v >= 1_000) return `₹${(v / 1_000).toFixed(1)}K Cr`;
  return `₹${v.toFixed(0)} Cr`;
}

const COLUMNS = [
  col.accessor("symbol", {
    header: "Symbol",
    cell: (i) => <span className="font-semibold text-white/90">{i.getValue()}</span>,
  }),
  col.accessor("company_name", {
    header: "Company",
    cell: (i) => (
      <span
        className="text-white/60 text-sm truncate max-w-[150px] block"
        title={i.getValue() ?? ""}
      >
        {i.getValue() ?? dash}
      </span>
    ),
  }),
  col.accessor("sector", {
    header: "Sector",
    cell: (i) =>
      i.getValue() ? (
        <span className="px-2 py-0.5 text-xs rounded-full bg-white/10 text-white/60 whitespace-nowrap border border-white/10">
          {i.getValue()}
        </span>
      ) : (
        dash
      ),
  }),
  col.accessor("price", {
    header: "Price",
    cell: (i) => i.getValue() != null ? <span className="text-white/80">₹{i.getValue()!.toFixed(2)}</span> : dash,
  }),
  col.accessor("pe_ratio", { header: "P/E", cell: (i) => fmt(i.getValue()) }),
  col.accessor("roe", { header: "ROE", cell: (i) => pctCell(i.getValue()) }),
  col.accessor("debt_to_equity", { header: "D/E", cell: (i) => fmt(i.getValue(), 2) }),
  col.accessor("revenue_growth_yoy", { header: "Rev Growth", cell: (i) => pctCell(i.getValue()) }),
  col.accessor("promoter_holding", {
    header: "Promoter",
    cell: (i) => (i.getValue() != null ? `${i.getValue()!.toFixed(1)}%` : dash),
  }),
  col.accessor("market_cap", { header: "Mkt Cap", cell: (i) => capCell(i.getValue()) }),
];

interface Props {
  stocks: Stock[];
  total: number;
  page: number;
  pageSize: number;
  sortBy: string;
  sortDir: "asc" | "desc";
  isLoading: boolean;
  onSort: (col: string) => void;
  onPage: (p: number) => void;
  onRowClick: (symbol: string) => void;
}

export function StockTable({
  stocks, total, page, pageSize, sortBy, sortDir,
  isLoading, onSort, onPage, onRowClick,
}: Props) {
  const table = useReactTable({
    data: stocks,
    columns: COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
  });

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-3">
      <p className="text-sm text-white/40 px-1">
        {isLoading ? "Loading…" : `${total.toLocaleString()} stocks`}
      </p>

      <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden shadow-xl shadow-black/20">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="bg-white/5 border-b border-white/10">
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      onClick={() => onSort(h.column.id)}
                      className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wide cursor-pointer hover:text-white/70 select-none whitespace-nowrap transition-colors"
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {sortBy === h.column.id && (
                        <span className="ml-1 text-blue-400">
                          {sortDir === "desc" ? "↓" : "↑"}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-white/5">
                      {COLUMNS.map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-white/10 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                : stocks.length === 0
                ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-4 py-16 text-center text-white/30 text-sm">
                      No stocks match your filters
                    </td>
                  </tr>
                )
                : table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => onRowClick(row.original.symbol)}
                      className="border-b border-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-white/40">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => onPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-white/20 bg-white/5 text-white/70 disabled:opacity-30 hover:bg-white/10 transition-colors"
            >
              ←
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
              if (p < 1 || p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => onPage(p)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    p === page
                      ? "bg-blue-500 text-white border-blue-500"
                      : "border-white/20 bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => onPage(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border border-white/20 bg-white/5 text-white/70 disabled:opacity-30 hover:bg-white/10 transition-colors"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

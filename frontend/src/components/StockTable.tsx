import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { Stock } from "../types/stock";

const col = createColumnHelper<Stock>();

const dash = <span className="text-slate-300">—</span>;

function fmt(v: number | null | undefined, d = 1) {
  return v != null ? v.toFixed(d) : dash;
}

function pctCell(v: number | null | undefined) {
  if (v == null) return dash;
  const cls = v > 0 ? "text-emerald-600" : v < 0 ? "text-red-500" : "text-slate-400";
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
    cell: (i) => <span className="font-semibold text-slate-900">{i.getValue()}</span>,
  }),
  col.accessor("company_name", {
    header: "Company",
    cell: (i) => (
      <span
        className="text-slate-600 text-sm truncate max-w-[150px] block"
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
        <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
          {i.getValue()}
        </span>
      ) : (
        dash
      ),
  }),
  col.accessor("price", {
    header: "Price",
    cell: (i) => (i.getValue() != null ? `₹${i.getValue()!.toFixed(2)}` : dash),
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
      <p className="text-sm text-slate-500 px-1">
        {isLoading ? "Loading…" : `${total.toLocaleString()} stocks`}
      </p>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="bg-slate-50 border-b border-slate-200">
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      onClick={() => onSort(h.column.id)}
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-700 select-none whitespace-nowrap"
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {sortBy === h.column.id && (
                        <span className="ml-1 text-blue-500">
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
                    <tr key={i} className="border-b border-slate-100">
                      {COLUMNS.map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-slate-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                : stocks.length === 0
                ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-4 py-16 text-center text-slate-400 text-sm">
                      No stocks match your filters
                    </td>
                  </tr>
                )
                : table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => onRowClick(row.original.symbol)}
                      className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors"
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
          <p className="text-xs text-slate-400">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => onPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50"
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
                  className={`px-3 py-1.5 text-sm rounded-lg border ${
                    p === page
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => onPage(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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
    cell: (i) => <span className="font-semibold text-white/90 text-sm">{i.getValue()}</span>,
  }),
  col.accessor("company_name", {
    header: "Company",
    cell: (i) => (
      <span className="text-white/50 text-sm truncate max-w-[150px] block" title={i.getValue() ?? ""}>
        {i.getValue() ?? dash}
      </span>
    ),
  }),
  col.accessor("sector", {
    header: "Sector",
    cell: (i) =>
      i.getValue() ? (
        <span className="px-2 py-0.5 text-xs rounded-full bg-white/[0.07] text-white/45 border border-white/[0.07] whitespace-nowrap">
          {i.getValue()}
        </span>
      ) : dash,
  }),
  col.accessor("price", {
    header: "Price",
    cell: (i) => i.getValue() != null ? <span className="text-white/80 text-sm">₹{i.getValue()!.toFixed(2)}</span> : dash,
  }),
  col.accessor("pe_ratio", { header: "P/E", cell: (i) => <span className="text-white/70 text-sm">{fmt(i.getValue())}</span> }),
  col.accessor("roe", { header: "ROE", cell: (i) => pctCell(i.getValue()) }),
  col.accessor("debt_to_equity", { header: "D/E", cell: (i) => <span className="text-white/70 text-sm">{fmt(i.getValue(), 2)}</span> }),
  col.accessor("revenue_growth_yoy", { header: "Rev Growth", cell: (i) => pctCell(i.getValue()) }),
  col.accessor("promoter_holding", {
    header: "Promoter",
    cell: (i) => (i.getValue() != null ? <span className="text-white/70 text-sm">{i.getValue()!.toFixed(1)}%</span> : dash),
  }),
  col.accessor("market_cap", { header: "Mkt Cap", cell: (i) => <span className="text-white/60 text-sm">{capCell(i.getValue())}</span> }),
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
      <p className="text-[11px] text-white/25 px-1 font-medium tracking-wide">
        {isLoading ? "Loading…" : `${total.toLocaleString()} stocks`}
      </p>

      <div className="bg-[rgba(28,28,30,0.72)] backdrop-blur-2xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.25)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-white/[0.07]">
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      onClick={() => onSort(h.column.id)}
                      className="px-4 py-3 text-left text-[10px] font-semibold text-white/25 uppercase tracking-[1.5px] cursor-pointer hover:text-white/50 select-none whitespace-nowrap transition-colors"
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {sortBy === h.column.id && (
                        <span className="ml-1 text-white/50">
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
                    <tr key={i} className="border-b border-white/[0.05]">
                      {COLUMNS.map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-3.5 bg-white/[0.06] rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                : stocks.length === 0
                ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-4 py-16 text-center text-white/25 text-sm">
                      No stocks match your filters
                    </td>
                  </tr>
                )
                : table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => onRowClick(row.original.symbol)}
                      className="border-b border-white/[0.05] hover:bg-white/[0.04] cursor-pointer transition-colors last:border-0"
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
        <div className="flex items-center justify-between px-1 pt-1">
          <p className="text-[11px] text-white/25">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => onPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs rounded-lg border border-white/[0.1] bg-white/[0.04] text-white/50 disabled:opacity-25 hover:bg-white/[0.08] transition-colors"
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
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    p === page
                      ? "bg-white/[0.14] text-white border-white/[0.15]"
                      : "border-white/[0.1] bg-white/[0.04] text-white/50 hover:bg-white/[0.08]"
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => onPage(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-xs rounded-lg border border-white/[0.1] bg-white/[0.04] text-white/50 disabled:opacity-25 hover:bg-white/[0.08] transition-colors"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

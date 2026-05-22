import type { Filters } from "../types/stock";

interface Props {
  filters: Filters;
  sectors: string[];
  onChange: (f: Filters) => void;
  onReset: () => void;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
      {children}
    </p>
  );
}

function NumInput({
  label, field, value, onChange, placeholder,
}: {
  label: string;
  field: keyof Filters;
  value: string;
  onChange: (f: keyof Filters, v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="number"
        value={value}
        placeholder={placeholder ?? "—"}
        onChange={(e) => onChange(field, e.target.value)}
        className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );
}

export function FilterPanel({ filters, sectors, onChange, onReset }: Props) {
  const set = (field: keyof Filters, v: string) => onChange({ ...filters, [field]: v });
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-slate-200 sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto">
      <div className="p-5 space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Filters</span>
          {hasFilters && (
            <button
              onClick={onReset}
              className="text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              Reset all
            </button>
          )}
        </div>

        <div>
          <Label>Sector</Label>
          <select
            value={filters.sector}
            onChange={(e) => set("sector", e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All sectors</option>
            {sectors.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <Label>P/E Ratio</Label>
          <div className="grid grid-cols-2 gap-2">
            <NumInput label="Min" field="pe_min" value={filters.pe_min} onChange={set} placeholder="0" />
            <NumInput label="Max" field="pe_max" value={filters.pe_max} onChange={set} placeholder="100" />
          </div>
        </div>

        <NumInput label="ROE min (%)" field="roe_min" value={filters.roe_min} onChange={set} placeholder="0" />
        <NumInput label="Debt / Equity max" field="debt_max" value={filters.debt_max} onChange={set} placeholder="2" />
        <NumInput label="Rev growth min (%)" field="revenue_growth_min" value={filters.revenue_growth_min} onChange={set} placeholder="0" />
        <NumInput label="Promoter holding min (%)" field="promoter_min" value={filters.promoter_min} onChange={set} placeholder="0" />
      </div>
    </aside>
  );
}

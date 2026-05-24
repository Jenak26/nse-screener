import type { Filters } from "../types/stock";

interface Props {
  filters: Filters;
  sectors: string[];
  onChange: (f: Filters) => void;
  onReset: () => void;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold text-white/30 uppercase tracking-[1.5px] mb-1.5">
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
        className="w-full px-3 py-1.5 text-sm bg-white/[0.06] border border-white/[0.08] rounded-lg text-white/80 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-colors"
      />
    </div>
  );
}

export function FilterPanel({ filters, sectors, onChange, onReset }: Props) {
  const set = (field: keyof Filters, v: string) => onChange({ ...filters, [field]: v });
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <aside className="w-56 shrink-0 sticky top-[70px] self-start">
      <div className="bg-[rgba(28,28,30,0.72)] backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-5 space-y-5 shadow-[0_4px_24px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-white/70">Filters</span>
          {hasFilters && (
            <button
              onClick={onReset}
              className="text-[11px] font-medium text-white/35 hover:text-white/60 transition-colors"
            >
              Reset
            </button>
          )}
        </div>

        <div>
          <Label>Sector</Label>
          <select
            value={filters.sector}
            onChange={(e) => set("sector", e.target.value)}
            className="w-full px-3 py-1.5 text-sm bg-white/[0.06] border border-white/[0.08] rounded-lg text-white/80 focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-colors"
          >
            <option value="" className="bg-[#1c1c1e]">All sectors</option>
            {sectors.map((s) => (
              <option key={s} value={s} className="bg-[#1c1c1e]">{s}</option>
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

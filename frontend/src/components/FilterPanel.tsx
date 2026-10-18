import { useEffect } from "react";
import type { Filters } from "../types/stock";
import { countActive } from "../lib/filters";

interface FieldsProps {
  filters: Filters;
  sectors: string[];
  onChange: (f: Filters) => void;
}

const inputCls =
  "num h-9 w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 text-sm text-slate-100 placeholder:text-slate-600 transition-colors focus:border-emerald-400/50 focus:outline-none";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span>
        {hint && <span className="text-[10px] text-slate-500">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function NumInput({ field, value, placeholder, label, onChange }: {
  field: keyof Filters;
  value: string;
  placeholder: string;
  label: string;
  onChange: (f: keyof Filters, v: string) => void;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step="any"
      value={value}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => onChange(field, e.target.value)}
      className={inputCls}
    />
  );
}

function FilterFields({ filters, sectors, onChange }: FieldsProps) {
  const set = (field: keyof Filters, v: string) => onChange({ ...filters, [field]: v });
  return (
    <div className="space-y-4">
      <Field label="Sector">
        <select value={filters.sector} onChange={(e) => set("sector", e.target.value)} aria-label="Sector" className={inputCls}>
          <option value="" className="bg-slate-900">All sectors</option>
          {sectors.map((s) => (
            <option key={s} value={s} className="bg-slate-900">{s}</option>
          ))}
        </select>
      </Field>
      <Field label="P/E ratio" hint="min – max">
        <div className="grid grid-cols-2 gap-2">
          <NumInput field="pe_min" label="Minimum P/E" value={filters.pe_min} onChange={set} placeholder="Min" />
          <NumInput field="pe_max" label="Maximum P/E" value={filters.pe_max} onChange={set} placeholder="Max" />
        </div>
      </Field>
      <Field label="ROE" hint="min %">
        <NumInput field="roe_min" label="Minimum ROE %" value={filters.roe_min} onChange={set} placeholder="e.g. 15" />
      </Field>
      <Field label="Debt / Equity" hint="max ×">
        <NumInput field="debt_max" label="Maximum debt to equity" value={filters.debt_max} onChange={set} placeholder="e.g. 0.5" />
      </Field>
      <Field label="Revenue growth" hint="min % YoY">
        <NumInput field="revenue_growth_min" label="Minimum revenue growth %" value={filters.revenue_growth_min} onChange={set} placeholder="e.g. 10" />
      </Field>
      <Field label="Promoter holding" hint="min %">
        <NumInput field="promoter_min" label="Minimum promoter holding %" value={filters.promoter_min} onChange={set} placeholder="e.g. 50" />
      </Field>
    </div>
  );
}

interface Props extends FieldsProps {
  onReset: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  resultCount?: number;
}

export function FilterPanel({ filters, sectors, onChange, onReset, mobileOpen, onMobileClose, resultCount }: Props) {
  const active = countActive(filters);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const h = (e: KeyboardEvent) => e.key === "Escape" && onMobileClose();
    window.addEventListener("keydown", h);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", h);
    };
  }, [mobileOpen, onMobileClose]);

  const heading = (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-slate-200">
        Filters
        {active > 0 && <span className="ml-2 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] text-emerald-300">{active}</span>}
      </h2>
      {active > 0 && (
        <button onClick={onReset} className="text-xs font-medium text-slate-400 hover:text-white">
          Reset
        </button>
      )}
    </div>
  );

  return (
    <>
      <aside className="hidden w-60 shrink-0 self-start lg:sticky lg:top-[76px] lg:block" aria-label="Filters">
        <div className="panel p-5">
          {heading}
          <FilterFields filters={filters} sectors={sectors} onChange={onChange} />
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onMobileClose} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-slate-900 p-5 pb-6 shadow-2xl">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" aria-hidden />
            {heading}
            <FilterFields filters={filters} sectors={sectors} onChange={onChange} />
            <button
              onClick={onMobileClose}
              className="mt-6 h-11 w-full rounded-xl bg-emerald-500 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              {resultCount != null ? `Show ${resultCount.toLocaleString()} stocks` : "Done"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

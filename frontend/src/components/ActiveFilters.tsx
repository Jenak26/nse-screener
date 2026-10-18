import type { Filters } from "../types/stock";
import { FILTER_CHIP, FILTER_KEYS } from "../lib/filters";

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  onClear: () => void;
}

export function ActiveFilters({ filters, onChange, onClear }: Props) {
  const active = FILTER_KEYS.filter((k) => filters[k].trim() !== "");
  if (active.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
      {active.map((k) => (
        <button
          key={k}
          onClick={() => onChange({ ...filters, [k]: "" })}
          aria-label={`Remove filter ${FILTER_CHIP[k](filters[k])}`}
          className="group flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 py-1 pl-2.5 pr-2 text-xs text-emerald-200 transition-colors hover:border-emerald-400/50"
        >
          {FILTER_CHIP[k](filters[k])}
          <span className="text-emerald-300/60 group-hover:text-emerald-100" aria-hidden>✕</span>
        </button>
      ))}
      {active.length > 1 && (
        <button onClick={onClear} className="px-2 text-xs text-slate-400 hover:text-white">
          Clear all
        </button>
      )}
    </div>
  );
}

import { useState } from "react";
import type { Filters } from "../types/stock";
import { BUILT_IN_PRESETS, DEFAULT_FILTERS, presetMatches, type Preset } from "../lib/filters";

const STORAGE_KEY = "nse_screener_presets";

function loadPresets(): Preset[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function savePresets(p: Preset[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // Storage blocked (private mode); presets just won't persist.
  }
}

interface Props {
  currentFilters: Filters;
  onApply: (f: Filters) => void;
}

const chip = "whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors";
const chipIdle = "border-white/10 text-slate-300 hover:border-white/25 hover:text-white";
const chipActive = "border-emerald-400/50 bg-emerald-400/15 text-emerald-200";

export function PresetBar({ currentFilters, onApply }: Props) {
  const [custom, setCustom] = useState<Preset[]>(loadPresets);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  const update = (next: Preset[]) => {
    setCustom(next);
    savePresets(next);
  };

  const save = () => {
    if (!name.trim()) return;
    const screen: Partial<Filters> = { ...currentFilters };
    delete screen.q;
    update([...custom, { name: name.trim(), filters: screen }]);
    setName("");
    setSaving(false);
  };

  // Clicking the active preset again clears it; the search box is left alone either way.
  const toggle = (p: Partial<Filters>, on: boolean) =>
    onApply({ ...DEFAULT_FILTERS, q: currentFilters.q, ...(on ? {} : p) });

  return (
    <div className="thin-scroll -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Presets</span>
      {BUILT_IN_PRESETS.map((p) => {
        const on = presetMatches(p.filters, currentFilters);
        return (
          <button key={p.name} onClick={() => toggle(p.filters, on)} aria-pressed={on} className={`${chip} ${on ? chipActive : chipIdle}`}>
            {p.name}
          </button>
        );
      })}
      {custom.map((p, i) => {
        const on = presetMatches(p.filters, currentFilters);
        return (
          <span key={`${p.name}-${i}`} className="group flex shrink-0 items-center">
            <button onClick={() => toggle(p.filters, on)} aria-pressed={on} className={`${chip} ${on ? chipActive : chipIdle} border-dashed`}>
              {p.name}
            </button>
            <button
              onClick={() => update(custom.filter((_, idx) => idx !== i))}
              aria-label={`Delete preset ${p.name}`}
              className="px-1.5 text-xs text-slate-500 opacity-60 hover:text-red-400 group-hover:opacity-100"
            >
              ✕
            </button>
          </span>
        );
      })}
      {saving ? (
        <form className="flex shrink-0 items-center gap-1" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setSaving(false)}
            placeholder="Preset name"
            aria-label="Preset name"
            maxLength={24}
            className="h-7 w-28 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/50 focus:outline-none"
          />
          <button type="submit" className="h-7 rounded-lg bg-white/10 px-2.5 text-xs text-white hover:bg-white/15">Save</button>
          <button type="button" onClick={() => setSaving(false)} className="h-7 px-2 text-xs text-slate-400 hover:text-white">Cancel</button>
        </form>
      ) : (
        <button onClick={() => setSaving(true)} className="shrink-0 whitespace-nowrap px-2 text-xs text-slate-400 hover:text-white">
          + Save current
        </button>
      )}
    </div>
  );
}

import { useState } from "react";
import type { Filters } from "../types/stock";

const STORAGE_KEY = "nse_screener_presets";
const BUILT_IN: { name: string; filters: Partial<Filters> }[] = [
  { name: "High ROE", filters: { roe_min: "20" } },
  { name: "Low Debt", filters: { debt_max: "0.5" } },
  { name: "Strong Promoters", filters: { promoter_min: "60" } },
  { name: "Growth", filters: { revenue_growth_min: "15", roe_min: "15" } },
  { name: "Value", filters: { pe_max: "15", roe_min: "12" } },
];

interface Preset { name: string; filters: Partial<Filters>; }

interface Props {
  currentFilters: Filters;
  defaultFilters: Filters;
  onApply: (f: Filters) => void;
}

export function PresetBar({ currentFilters, defaultFilters, onApply }: Props) {
  const [custom, setCustom] = useState<Preset[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); }
    catch { return []; }
  });
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  const savePreset = () => {
    if (!name.trim()) return;
    const next = [...custom, { name: name.trim(), filters: { ...currentFilters } }];
    setCustom(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setName("");
    setSaving(false);
  };

  const deletePreset = (i: number) => {
    const next = custom.filter((_, idx) => idx !== i);
    setCustom(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const apply = (filters: Partial<Filters>) =>
    onApply({ ...defaultFilters, ...filters });

  return (
    <div className="flex items-center gap-2 px-6 py-2 bg-white border-b border-slate-100 overflow-x-auto">
      <span className="text-xs text-slate-400 font-medium shrink-0">Presets:</span>
      {BUILT_IN.map((p) => (
        <button key={p.name} onClick={() => apply(p.filters)}
          className="px-3 py-1 text-xs rounded-full border border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-700 whitespace-nowrap transition-colors">
          {p.name}
        </button>
      ))}
      {custom.map((p, i) => (
        <div key={i} className="flex items-center gap-0.5 group">
          <button onClick={() => apply(p.filters)}
            className="px-3 py-1 text-xs rounded-full border border-blue-200 text-blue-700 hover:bg-blue-50 whitespace-nowrap">
            {p.name}
          </button>
          <button onClick={() => deletePreset(i)}
            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 text-xs px-1">
            ×
          </button>
        </div>
      ))}
      {saving ? (
        <div className="flex items-center gap-1 shrink-0">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && savePreset()}
            placeholder="Preset name" className="px-2 py-1 text-xs border border-slate-200 rounded-lg w-28 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <button onClick={savePreset} className="px-2 py-1 text-xs bg-blue-600 text-white rounded-lg">Save</button>
          <button onClick={() => setSaving(false)} className="px-2 py-1 text-xs text-slate-400 hover:text-slate-600">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setSaving(true)}
          className="px-3 py-1 text-xs text-slate-400 hover:text-blue-600 whitespace-nowrap">
          + Save current
        </button>
      )}
    </div>
  );
}

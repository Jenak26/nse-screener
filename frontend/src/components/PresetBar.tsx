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
    <div className="flex items-center gap-2 px-4 py-2.5 overflow-x-auto">
      <span className="text-[10px] font-semibold text-white/25 uppercase tracking-[1.5px] shrink-0">Presets</span>
      <div className="w-px h-3 bg-white/[0.1] shrink-0" />
      {BUILT_IN.map((p) => (
        <button key={p.name} onClick={() => apply(p.filters)}
          className="px-3 py-1 text-xs rounded-full border border-white/[0.1] text-white/45 hover:border-white/25 hover:text-white/75 whitespace-nowrap transition-colors">
          {p.name}
        </button>
      ))}
      {custom.map((p, i) => (
        <div key={i} className="flex items-center gap-0.5 group shrink-0">
          <button onClick={() => apply(p.filters)}
            className="px-3 py-1 text-xs rounded-full border border-white/[0.18] text-white/60 hover:bg-white/[0.06] whitespace-nowrap transition-colors">
            {p.name}
          </button>
          <button onClick={() => deletePreset(i)}
            className="opacity-0 group-hover:opacity-100 text-white/25 hover:text-red-400 text-xs px-1 transition-all">
            ×
          </button>
        </div>
      ))}
      {saving ? (
        <div className="flex items-center gap-1 shrink-0">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && savePreset()}
            placeholder="Name…"
            className="px-2.5 py-1 text-xs bg-white/[0.06] border border-white/[0.1] text-white/80 placeholder-white/25 rounded-lg w-24 focus:outline-none focus:ring-1 focus:ring-white/20" />
          <button onClick={savePreset}
            className="px-2.5 py-1 text-xs bg-white/[0.1] border border-white/[0.12] text-white/80 rounded-lg hover:bg-white/[0.15] transition-colors">
            Save
          </button>
          <button onClick={() => setSaving(false)}
            className="px-2 py-1 text-xs text-white/30 hover:text-white/50 transition-colors">
            ✕
          </button>
        </div>
      ) : (
        <button onClick={() => setSaving(true)}
          className="px-3 py-1 text-xs text-white/25 hover:text-white/50 whitespace-nowrap transition-colors shrink-0">
          + Save
        </button>
      )}
    </div>
  );
}

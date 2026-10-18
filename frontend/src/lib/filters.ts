import type { Filters } from "../types/stock";

export const DEFAULT_FILTERS: Filters = {
  q: "",
  sector: "",
  pe_min: "",
  pe_max: "",
  roe_min: "",
  debt_max: "",
  revenue_growth_min: "",
  promoter_min: "",
};

export const FILTER_KEYS = Object.keys(DEFAULT_FILTERS) as (keyof Filters)[];

// Human-readable chip text for each active filter.
export const FILTER_CHIP: Record<keyof Filters, (v: string) => string> = {
  q: (v) => `“${v}”`,
  sector: (v) => v,
  pe_min: (v) => `P/E ≥ ${v}`,
  pe_max: (v) => `P/E ≤ ${v}`,
  roe_min: (v) => `ROE ≥ ${v}%`,
  debt_max: (v) => `D/E ≤ ${v}`,
  revenue_growth_min: (v) => `Rev growth ≥ ${v}%`,
  promoter_min: (v) => `Promoter ≥ ${v}%`,
};

export interface Preset {
  name: string;
  filters: Partial<Filters>;
}

export const BUILT_IN_PRESETS: Preset[] = [
  { name: "High ROE", filters: { roe_min: "20" } },
  { name: "Low Debt", filters: { debt_max: "0.5" } },
  { name: "Strong Promoters", filters: { promoter_min: "60" } },
  { name: "Growth", filters: { revenue_growth_min: "15", roe_min: "15" } },
  { name: "Value", filters: { pe_max: "15", roe_min: "12" } },
];

// Screening filters only: the search box is independent of presets and the filter count.
const SCREEN_KEYS = FILTER_KEYS.filter((k) => k !== "q");

export function countActive(f: Filters): number {
  return SCREEN_KEYS.filter((k) => f[k] !== "").length;
}

export function presetMatches(preset: Partial<Filters>, f: Filters): boolean {
  return SCREEN_KEYS.every((k) => (preset[k] ?? "") === f[k]);
}

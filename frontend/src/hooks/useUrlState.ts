import { useEffect } from "react";
import type { Filters } from "../types/stock";
import { DEFAULT_FILTERS, FILTER_KEYS } from "../lib/filters";

export type Tab = "screener" | "sectors";

export interface ScreenState {
  filters: Filters;
  sortBy: string;
  sortDir: "asc" | "desc";
  page: number;
  tab: Tab;
  stock: string | null;
}

export const DEFAULT_STATE: ScreenState = {
  filters: DEFAULT_FILTERS,
  sortBy: "market_cap",
  sortDir: "desc",
  page: 1,
  tab: "screener",
  stock: null,
};

export function readUrlState(): ScreenState {
  const p = new URLSearchParams(window.location.search);
  const filters = { ...DEFAULT_FILTERS };
  for (const k of FILTER_KEYS) filters[k] = p.get(k) ?? "";
  const page = Number(p.get("page"));
  return {
    filters,
    sortBy: p.get("sort") ?? DEFAULT_STATE.sortBy,
    sortDir: p.get("dir") === "asc" ? "asc" : "desc",
    page: Number.isInteger(page) && page > 0 ? page : 1,
    tab: p.get("tab") === "sectors" ? "sectors" : "screener",
    stock: p.get("stock"),
  };
}

// Mirrors the screen into the query string so any view can be shared as a link.
export function useSyncUrl(s: ScreenState) {
  useEffect(() => {
    const p = new URLSearchParams();
    for (const k of FILTER_KEYS) if (s.filters[k]) p.set(k, s.filters[k]);
    if (s.sortBy !== DEFAULT_STATE.sortBy) p.set("sort", s.sortBy);
    if (s.sortDir !== DEFAULT_STATE.sortDir) p.set("dir", s.sortDir);
    if (s.page > 1) p.set("page", String(s.page));
    if (s.tab !== "screener") p.set("tab", s.tab);
    if (s.stock) p.set("stock", s.stock);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [s.filters, s.sortBy, s.sortDir, s.page, s.tab, s.stock]);
}

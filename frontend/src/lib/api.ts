import type { Filters, Meta, Sector, Stock, StockDetail, StocksResponse } from "../types/stock";
import { FILTER_KEYS } from "./filters";

// Same-origin by default: vercel.json proxies /api/* to the backend in production and
// vite.config.ts proxies it to localhost:8000 in dev. VITE_API_BASE overrides both.
const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export function fetchStocks(
  filters: Filters,
  sortBy: string,
  sortDir: string,
  page: number,
  pageSize = 20,
): Promise<StocksResponse> {
  const p = new URLSearchParams({
    sort_by: sortBy,
    sort_dir: sortDir,
    page: String(page),
    page_size: String(pageSize),
  });
  for (const k of FILTER_KEYS) {
    const v = filters[k].trim();
    if (v) p.set(k, v);
  }
  return get<StocksResponse>(`/api/stocks?${p}`);
}

// Every row matching the current screen, in the API's max page size (used for CSV export).
export async function fetchAllStocks(filters: Filters, sortBy: string, sortDir: string): Promise<Stock[]> {
  const all: Stock[] = [];
  for (let page = 1; ; page++) {
    const res = await fetchStocks(filters, sortBy, sortDir, page, 100);
    all.push(...res.stocks);
    if (all.length >= res.total || res.stocks.length === 0) return all;
  }
}

export const fetchStock = (symbol: string): Promise<StockDetail> =>
  get<StockDetail>(`/api/stocks/${encodeURIComponent(symbol)}`);

export const fetchSectors = (): Promise<Sector[]> => get<Sector[]>("/api/sectors");

export const fetchMeta = (): Promise<Meta> => get<Meta>("/api/meta");

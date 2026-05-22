import type { Filters, Meta, Sector, StockDetail, StocksResponse } from "../types/stock";

const BASE = (import.meta.env.VITE_API_URL as string) ?? "http://localhost:8000";

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
  if (filters.sector) p.set("sector", filters.sector);
  if (filters.pe_min) p.set("pe_min", filters.pe_min);
  if (filters.pe_max) p.set("pe_max", filters.pe_max);
  if (filters.roe_min) p.set("roe_min", filters.roe_min);
  if (filters.debt_max) p.set("debt_max", filters.debt_max);
  if (filters.revenue_growth_min) p.set("revenue_growth_min", filters.revenue_growth_min);
  if (filters.promoter_min) p.set("promoter_min", filters.promoter_min);
  return get<StocksResponse>(`/api/stocks?${p}`);
}

export const fetchStock = (symbol: string): Promise<StockDetail> =>
  get<StockDetail>(`/api/stocks/${symbol}`);

export const fetchSectors = (): Promise<Sector[]> => get<Sector[]>("/api/sectors");

export const fetchMeta = (): Promise<Meta> => get<Meta>("/api/meta");

import { useQuery } from "@tanstack/react-query";
import { fetchMeta, fetchSectors, fetchStock, fetchStocks } from "../lib/api";
import type { Filters } from "../types/stock";

export function useStocks(filters: Filters, sortBy: string, sortDir: string, page: number) {
  return useQuery({
    queryKey: ["stocks", filters, sortBy, sortDir, page],
    queryFn: () => fetchStocks(filters, sortBy, sortDir, page),
    placeholderData: (prev) => prev,
  });
}

export function useSectors() {
  return useQuery({
    queryKey: ["sectors"],
    queryFn: fetchSectors,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMeta() {
  return useQuery({
    queryKey: ["meta"],
    queryFn: fetchMeta,
    refetchInterval: 60_000,
  });
}

export function useStockDetail(symbol: string | null) {
  return useQuery({
    queryKey: ["stock", symbol],
    queryFn: () => fetchStock(symbol!),
    enabled: !!symbol,
  });
}

import type { Stock } from "../types/stock";

const COLUMNS: (keyof Stock)[] = [
  "symbol", "company_name", "sector", "price", "market_cap", "pe_ratio", "roe",
  "debt_to_equity", "revenue_growth_yoy", "promoter_holding", "current_ratio", "fifty_two_week_high",
];

function cell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(stocks: Stock[], filename: string) {
  const lines = [COLUMNS.join(","), ...stocks.map((s) => COLUMNS.map((c) => cell(s[c])).join(","))];
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

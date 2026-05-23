export interface Stock {
  symbol: string;
  company_name: string | null;
  sector: string | null;
  market_cap: number | null;
  pe_ratio: number | null;
  roe: number | null;
  debt_to_equity: number | null;
  revenue_growth_yoy: number | null;
  promoter_holding: number | null;
  current_ratio: number | null;
  price: number | null;
  fifty_two_week_high: number | null;
  updated_at: string | null;
}

export interface MetricPoint {
  quarter: string;
  value: number;
}

export interface StockDetail extends Stock {
  sector_rank: {
    pe_percentile?: number | null;
    roe_percentile?: number | null;
    debt_percentile?: number | null;
    revenue_growth_percentile?: number | null;
    promoter_percentile?: number | null;
  };
  history: Record<string, MetricPoint[]>;
}

export interface StocksResponse {
  stocks: Stock[];
  total: number;
  last_updated: string | null;
}

export interface Sector {
  sector: string;
  avg_pe: number | null;
  avg_roe: number | null;
  avg_debt_to_equity: number | null;
  stock_count: number;
}

export interface Meta {
  last_updated: string | null;
  total_stocks: number;
  pipeline_status: string;
}

export interface Filters {
  sector: string;
  pe_min: string;
  pe_max: string;
  roe_min: string;
  debt_max: string;
  revenue_growth_min: string;
  promoter_min: string;
}

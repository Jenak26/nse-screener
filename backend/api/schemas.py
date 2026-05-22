from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class StockOut(BaseModel):
    symbol: str
    company_name: Optional[str] = None
    sector: Optional[str] = None
    market_cap: Optional[float] = None
    pe_ratio: Optional[float] = None
    roe: Optional[float] = None
    debt_to_equity: Optional[float] = None
    revenue_growth_yoy: Optional[float] = None
    promoter_holding: Optional[float] = None
    current_ratio: Optional[float] = None
    price: Optional[float] = None
    fifty_two_week_high: Optional[float] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class StockDetailOut(StockOut):
    sector_rank: dict = {}


class StocksResponse(BaseModel):
    stocks: list[StockOut]
    total: int
    last_updated: Optional[str] = None


class SectorOut(BaseModel):
    sector: str
    avg_pe: Optional[float] = None
    avg_roe: Optional[float] = None
    avg_debt_to_equity: Optional[float] = None
    stock_count: int


class MetaOut(BaseModel):
    last_updated: Optional[str] = None
    total_stocks: int
    pipeline_status: str

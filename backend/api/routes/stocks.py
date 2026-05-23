from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.api.schemas import StockDetailOut, StocksResponse
from backend.database.db import get_session
from backend.database.queries import (
    get_last_updated,
    get_metric_history,
    get_sector_percentiles,
    get_stock_by_symbol,
    get_stocks,
)

router = APIRouter()


@router.get("/stocks", response_model=StocksResponse)
def list_stocks(
    sector: Optional[str] = None,
    pe_min: Optional[float] = None,
    pe_max: Optional[float] = None,
    roe_min: Optional[float] = None,
    debt_max: Optional[float] = None,
    revenue_growth_min: Optional[float] = None,
    promoter_min: Optional[float] = None,
    sort_by: str = Query("market_cap"),
    sort_dir: str = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
):
    stocks, total = get_stocks(
        session, sector, pe_min, pe_max, roe_min,
        debt_max, revenue_growth_min, promoter_min,
        sort_by, sort_dir, page, page_size,
    )
    return StocksResponse(
        stocks=stocks,
        total=total,
        last_updated=get_last_updated(session),
    )


@router.get("/stocks/{symbol}", response_model=StockDetailOut)
def get_stock(symbol: str, session: Session = Depends(get_session)):
    stock = get_stock_by_symbol(session, symbol.upper())
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    rank = get_sector_percentiles(session, symbol.upper())
    history = get_metric_history(
        session, symbol.upper(),
        ["pe_ratio", "roe", "revenue_growth_yoy", "debt_to_equity"],
    )
    return StockDetailOut(
        **{c.key: getattr(stock, c.key) for c in stock.__table__.columns},
        sector_rank=rank,
        history=history,
    )

from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from backend.database.models import Stock

VALID_SORT_COLUMNS = {
    "symbol", "company_name", "sector", "market_cap", "pe_ratio",
    "roe", "debt_to_equity", "revenue_growth_yoy", "promoter_holding",
    "price", "fifty_two_week_high", "current_ratio",
}


def get_stocks(
    session: Session,
    sector: Optional[str] = None,
    pe_min: Optional[float] = None,
    pe_max: Optional[float] = None,
    roe_min: Optional[float] = None,
    debt_max: Optional[float] = None,
    revenue_growth_min: Optional[float] = None,
    promoter_min: Optional[float] = None,
    sort_by: str = "market_cap",
    sort_dir: str = "desc",
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Stock], int]:
    if sort_by not in VALID_SORT_COLUMNS:
        sort_by = "market_cap"

    q = select(Stock)
    if sector:
        q = q.where(Stock.sector == sector)
    if pe_min is not None:
        q = q.where(Stock.pe_ratio >= pe_min)
    if pe_max is not None:
        q = q.where(Stock.pe_ratio <= pe_max)
    if roe_min is not None:
        q = q.where(Stock.roe >= roe_min)
    if debt_max is not None:
        q = q.where(Stock.debt_to_equity <= debt_max)
    if revenue_growth_min is not None:
        q = q.where(Stock.revenue_growth_yoy >= revenue_growth_min)
    if promoter_min is not None:
        q = q.where(Stock.promoter_holding >= promoter_min)

    total = session.scalar(select(func.count()).select_from(q.subquery())) or 0

    sort_col = getattr(Stock, sort_by)
    order = sort_col.desc().nulls_last() if sort_dir == "desc" else sort_col.asc().nulls_last()
    q = q.order_by(order).offset((page - 1) * page_size).limit(page_size)

    return list(session.scalars(q).all()), total


def get_stock_by_symbol(session: Session, symbol: str) -> Optional[Stock]:
    return session.get(Stock, symbol)


def get_sector_stats(session: Session) -> list[dict]:
    q = (
        select(
            Stock.sector,
            func.avg(Stock.pe_ratio).label("avg_pe"),
            func.avg(Stock.roe).label("avg_roe"),
            func.avg(Stock.debt_to_equity).label("avg_debt_to_equity"),
            func.count().label("stock_count"),
        )
        .where(Stock.sector.isnot(None))
        .group_by(Stock.sector)
        .order_by(func.count().desc())
    )
    return [
        {
            "sector": r.sector,
            "avg_pe": round(r.avg_pe, 2) if r.avg_pe else None,
            "avg_roe": round(r.avg_roe, 2) if r.avg_roe else None,
            "avg_debt_to_equity": round(r.avg_debt_to_equity, 2) if r.avg_debt_to_equity else None,
            "stock_count": r.stock_count,
        }
        for r in session.execute(q).all()
    ]


def get_sector_percentiles(session: Session, symbol: str) -> dict:
    stock = session.get(Stock, symbol)
    if not stock or not stock.sector:
        return {}
    peers = list(session.scalars(select(Stock).where(Stock.sector == stock.sector)).all())

    def pct(val, field, higher_is_better: bool = True):
        if val is None:
            return None
        vals = [getattr(s, field) for s in peers if getattr(s, field) is not None]
        if not vals:
            return None
        rank = sum(1 for v in vals if v <= val)
        raw = round(rank / len(vals) * 100)
        return raw if higher_is_better else 100 - raw

    return {
        "pe_percentile": pct(stock.pe_ratio, "pe_ratio", higher_is_better=False),
        "roe_percentile": pct(stock.roe, "roe"),
        "debt_percentile": pct(stock.debt_to_equity, "debt_to_equity", higher_is_better=False),
        "revenue_growth_percentile": pct(stock.revenue_growth_yoy, "revenue_growth_yoy"),
        "promoter_percentile": pct(stock.promoter_holding, "promoter_holding"),
    }


def get_last_updated(session: Session) -> Optional[str]:
    result = session.scalar(select(func.max(Stock.updated_at)))
    return result.isoformat() if result else None


def get_distinct_sectors(session: Session) -> list[str]:
    return list(session.scalars(
        select(Stock.sector).where(Stock.sector.isnot(None)).distinct().order_by(Stock.sector)
    ).all())

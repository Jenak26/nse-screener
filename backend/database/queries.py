from datetime import datetime
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from backend.database.models import MetricHistory, Stock

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

    # COUNT(*) OVER () rides along with the page rows, so filtering, counting and
    # paginating cost a single database round-trip instead of a count query + page query.
    filtered = q
    q = q.add_columns(func.count().over().label("total"))

    sort_col = getattr(Stock, sort_by)
    order = sort_col.desc().nulls_last() if sort_dir == "desc" else sort_col.asc().nulls_last()
    q = q.order_by(order, Stock.symbol).offset((page - 1) * page_size).limit(page_size)

    rows = session.execute(q).all()
    if rows:
        return [r[0] for r in rows], rows[0].total
    if page > 1:
        # Past the last page the window count has no row to ride on; fall back once.
        return [], session.scalar(select(func.count()).select_from(filtered.subquery())) or 0
    return [], 0


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


def get_last_updated_dt(session: Session) -> Optional[datetime]:
    return session.scalar(select(func.max(Stock.updated_at)))


def get_last_updated(session: Session) -> Optional[str]:
    result = get_last_updated_dt(session)
    return result.isoformat() if result else None


def get_distinct_sectors(session: Session) -> list[str]:
    return list(session.scalars(
        select(Stock.sector).where(Stock.sector.isnot(None)).distinct().order_by(Stock.sector)
    ).all())


def get_metric_history(session: Session, symbol: str, metrics: list[str]) -> dict[str, list[dict]]:
    """Return {metric: [{quarter, value}, ...]} sorted oldest-first, last 8 quarters."""
    # Rank each metric's points newest-first in one query, keep the latest 8 per metric.
    rn = func.row_number().over(
        partition_by=MetricHistory.metric, order_by=MetricHistory.recorded_at.desc()
    ).label("rn")
    ranked = (
        select(MetricHistory.metric, MetricHistory.quarter, MetricHistory.value,
               MetricHistory.recorded_at, rn)
        .where(MetricHistory.symbol == symbol, MetricHistory.metric.in_(metrics))
        .subquery()
    )
    rows = session.execute(
        select(ranked).where(ranked.c.rn <= 8).order_by(ranked.c.metric, ranked.c.recorded_at.asc())
    ).all()

    result: dict[str, list[dict]] = {m: [] for m in metrics}
    for r in rows:
        result[r.metric].append({"quarter": r.quarter, "value": r.value})
    return result

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, Index, Integer, Text
from sqlalchemy.orm import DeclarativeBase


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


class Stock(Base):
    __tablename__ = "stocks"

    symbol = Column(Text, primary_key=True)
    company_name = Column(Text)
    sector = Column(Text)
    market_cap = Column(Float)
    pe_ratio = Column(Float)
    roe = Column(Float)
    debt_to_equity = Column(Float)
    revenue_growth_yoy = Column(Float)
    promoter_holding = Column(Float)
    current_ratio = Column(Float)
    price = Column(Float)
    fifty_two_week_high = Column(Float)
    updated_at = Column(DateTime, default=utcnow)

    __table_args__ = (
        # Sector is the most common filter and drives the peer-percentile lookup;
        # pairing it with market_cap serves the default "sector, sorted by size" view.
        Index("ix_stocks_sector_mcap", "sector", "market_cap"),
        Index("ix_stocks_market_cap", "market_cap"),
        Index("ix_stocks_updated_at", "updated_at"),
    )


class MetricHistory(Base):
    __tablename__ = "metric_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(Text, nullable=False)
    metric = Column(Text, nullable=False)   # "roe", "pe_ratio", "revenue_growth_yoy", "debt_to_equity"
    value = Column(Float, nullable=False)
    quarter = Column(Text, nullable=False)  # "Q1FY26"
    recorded_at = Column(DateTime, default=utcnow)

    __table_args__ = (
        # One point per (symbol, metric, quarter): the daily pipeline overwrites the
        # current quarter instead of appending a duplicate row every day.
        Index("uq_history_point", "symbol", "metric", "quarter", unique=True),
        Index("ix_history_lookup", "symbol", "metric", "recorded_at"),
    )

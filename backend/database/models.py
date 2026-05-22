from datetime import datetime

from sqlalchemy import Column, DateTime, Float, Text
from sqlalchemy.orm import DeclarativeBase


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
    updated_at = Column(DateTime, default=datetime.utcnow)

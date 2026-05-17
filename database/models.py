from sqlalchemy import Column, Integer, Text, Float, UniqueConstraint, Index
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

class Stock(Base):
    __tablename__ = "stocks"
    symbol = Column(Text, primary_key=True)
    company_name = Column(Text)
    sector = Column(Text)
    market_cap = Column(Float)
    is_fno = Column(Integer, default=0)
    lot_size = Column(Integer)

class Candle(Base):
    __tablename__ = "candles"
    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(Text, nullable=False)
    timeframe = Column(Text, nullable=False)
    timestamp = Column(Integer, nullable=False)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(Integer)
    __table_args__ = (
        UniqueConstraint("symbol", "timeframe", "timestamp"),
        Index("idx_candles", "symbol", "timeframe", "timestamp"),
    )

class DetectedPattern(Base):
    __tablename__ = "detected_patterns"
    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(Text, nullable=False)
    timeframe = Column(Text, nullable=False)
    pattern_name = Column(Text, nullable=False)
    confidence_score = Column(Integer, nullable=False)
    trend_direction = Column(Text)
    volume_confirmation = Column(Integer, default=0)
    detected_at = Column(Integer, nullable=False)
    __table_args__ = (
        UniqueConstraint("symbol", "pattern_name", "timeframe", "detected_at"),
        Index("idx_patterns", "detected_at", "confidence_score"),
    )

class SectorStrength(Base):
    __tablename__ = "sector_strength"
    sector = Column(Text, primary_key=True)
    strength_score = Column(Float)
    momentum_score = Column(Float)
    updated_at = Column(Integer)

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(Text)
    alert_type = Column(Text)
    message = Column(Text)
    sent_at = Column(Integer)

class Watchlist(Base):
    __tablename__ = "watchlists"
    id = Column(Integer, primary_key=True, autoincrement=True)
    list_name = Column(Text, nullable=False)
    symbol = Column(Text, nullable=False)
    notes = Column(Text)
    tags = Column(Text)
    added_at = Column(Integer)

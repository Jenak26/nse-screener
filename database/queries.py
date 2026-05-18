import time
import pandas as pd
from database.db import get_session
from database.models import DetectedPattern, Stock, SectorStrength


def get_recent_signals(hours: int = 24, min_confidence: int = 0) -> pd.DataFrame:
    cutoff = int(time.time()) - hours * 3600
    session = get_session()
    try:
        rows = (
            session.query(DetectedPattern)
            .filter(
                DetectedPattern.detected_at >= cutoff,
                DetectedPattern.confidence_score >= min_confidence,
            )
            .order_by(DetectedPattern.detected_at.desc())
            .limit(500)
            .all()
        )
        if not rows:
            return pd.DataFrame()
        return pd.DataFrame([{
            "symbol":     r.symbol,
            "pattern":    r.pattern_name,
            "timeframe":  r.timeframe,
            "confidence": r.confidence_score,
            "direction":  r.trend_direction,
            "volume_ok":  bool(r.volume_confirmation),
            "detected_at": r.detected_at,
        } for r in rows])
    finally:
        session.close()


def get_top_momentum_stocks(limit: int = 50, fno_only: bool = False) -> pd.DataFrame:
    """Returns symbols ranked by confidence score of their latest bullish signals."""
    session = get_session()
    try:
        cutoff = int(time.time()) - 24 * 3600
        q = (
            session.query(
                DetectedPattern.symbol,
                Stock.sector,
                Stock.is_fno,
                DetectedPattern.confidence_score,
                DetectedPattern.trend_direction,
                DetectedPattern.detected_at,
            )
            .join(Stock, Stock.symbol == DetectedPattern.symbol)
            .filter(
                DetectedPattern.detected_at >= cutoff,
                DetectedPattern.trend_direction == "bullish",
            )
        )
        if fno_only:
            q = q.filter(Stock.is_fno == 1)
        rows = q.order_by(DetectedPattern.confidence_score.desc()).limit(limit * 3).all()
        if not rows:
            return pd.DataFrame()
        # Deduplicate — keep best signal per symbol
        seen: dict = {}
        for r in rows:
            if r.symbol not in seen:
                seen[r.symbol] = r
        top = list(seen.values())[:limit]
        return pd.DataFrame([{
            "symbol":     r.symbol,
            "sector":     r.sector,
            "is_fno":     r.is_fno,
            "confidence": r.confidence_score,
            "direction":  r.trend_direction,
        } for r in top])
    finally:
        session.close()


def get_sector_strength() -> pd.DataFrame:
    session = get_session()
    try:
        rows = (
            session.query(SectorStrength)
            .order_by(SectorStrength.strength_score.desc())
            .all()
        )
        if not rows:
            return pd.DataFrame()
        return pd.DataFrame([{
            "sector":   r.sector,
            "strength": r.strength_score,
            "momentum": r.momentum_score,
        } for r in rows])
    finally:
        session.close()

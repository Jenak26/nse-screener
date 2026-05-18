import importlib
import time
import logging
import pandas as pd
from database.db import get_session
from database.models import Candle, DetectedPattern

logger = logging.getLogger(__name__)

PATTERN_MODULES = [
    "backend.patterns.hammer",
    "backend.patterns.engulfing",
    "backend.patterns.morning_star",
    "backend.patterns.doji",
    "backend.patterns.orb",
    "backend.patterns.vwap_bounce",
    "backend.patterns.volume_breakout",
    "backend.patterns.gap_up",
]

PATTERN_TIMEFRAMES = {
    "backend.patterns.hammer":          ["15m", "1H", "Daily"],
    "backend.patterns.engulfing":       ["15m", "1H", "Daily"],
    "backend.patterns.morning_star":    ["1H", "Daily"],
    "backend.patterns.doji":            ["15m", "1H", "Daily"],
    "backend.patterns.orb":             ["5m", "15m"],
    "backend.patterns.vwap_bounce":     ["5m", "15m"],
    "backend.patterns.volume_breakout": ["15m", "1H", "Daily"],
    "backend.patterns.gap_up":          ["Daily", "15m"],
}


def get_candles_from_db(symbol: str, timeframe: str, limit: int = 50) -> pd.DataFrame:
    session = get_session()
    try:
        rows = (
            session.query(Candle)
            .filter_by(symbol=symbol, timeframe=timeframe)
            .order_by(Candle.timestamp.desc())
            .limit(limit)
            .all()
        )
        if not rows:
            return pd.DataFrame()
        df = pd.DataFrame([{
            "open": r.open, "high": r.high, "low": r.low,
            "close": r.close, "volume": r.volume, "timestamp": r.timestamp,
        } for r in reversed(rows)])
        return df
    finally:
        session.close()


def _write_signal(symbol: str, timeframe: str, pattern_name: str,
                  confidence: int, direction: str, vol_confirmation: bool) -> None:
    session = get_session()
    try:
        ts = int(time.time())
        existing = (
            session.query(DetectedPattern)
            .filter_by(symbol=symbol, pattern_name=pattern_name, timeframe=timeframe, detected_at=ts)
            .first()
        )
        if existing:
            return
        session.add(DetectedPattern(
            symbol=symbol, timeframe=timeframe, pattern_name=pattern_name,
            confidence_score=confidence, trend_direction=direction,
            volume_confirmation=1 if vol_confirmation else 0,
            detected_at=ts,
        ))
        session.commit()
    except Exception:
        session.rollback()
    finally:
        session.close()


def run_scan_for_symbol(symbol: str, timeframes: list[str] | None = None) -> None:
    for module_path in PATTERN_MODULES:
        pattern_name = module_path.split(".")[-1]
        allowed_tfs = PATTERN_TIMEFRAMES.get(module_path, ["Daily"])
        scan_tfs = [tf for tf in (timeframes or allowed_tfs) if tf in allowed_tfs]

        try:
            mod = importlib.import_module(module_path)
        except ImportError:
            continue

        for tf in scan_tfs:
            candles = get_candles_from_db(symbol, tf)
            if candles.empty:
                continue
            try:
                result = mod.detect(candles)
                if result.detected and result.confidence > 0:
                    vol_confirm = result.metadata.get("vol_ratio", 1.0) >= 1.5
                    _write_signal(symbol, tf, pattern_name, result.confidence,
                                  result.direction, vol_confirm)
            except Exception as e:
                logger.warning(f"Pattern {pattern_name} failed on {symbol}/{tf}: {e}")


def run_full_scan(symbols: list[str], timeframes: list[str] | None = None) -> None:
    for symbol in symbols:
        run_scan_for_symbol(symbol, timeframes)

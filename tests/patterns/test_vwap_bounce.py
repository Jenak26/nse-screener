import pandas as pd
from tests.patterns.conftest import make_candles
from backend.patterns.base import PatternResult

def test_vwap_bounce_returns_pattern_result():
    from backend.patterns.vwap_bounce import detect
    rows = []
    for i in range(18):
        base = 100.0 + i * 0.2
        rows.append({"o": base, "h": base+1, "l": base-0.5, "c": base+0.5, "v": 1_000_000})
    # Dip near VWAP then bullish rejection
    rows.append({"o": 103.5, "h": 104, "l": 101, "c": 103.8, "v": 1_000_000})
    rows.append({"o": 103.2, "h": 106, "l": 103, "c": 105.5, "v": 1_900_000})
    df = make_candles(rows)
    result = detect(df)
    assert isinstance(result, PatternResult)
    assert 0 <= result.confidence <= 100
    assert result.direction in ("bullish", "bearish", "neutral")

def test_vwap_bounce_needs_minimum_candles():
    from backend.patterns.vwap_bounce import detect
    df = make_candles([{"o": 100, "h": 101, "l": 99, "c": 100.5}] * 5)
    result = detect(df)
    assert result.detected is False

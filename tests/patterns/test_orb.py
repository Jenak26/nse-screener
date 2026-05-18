from tests.patterns.conftest import make_candles
from backend.patterns.orb import detect

def test_orb_breakout_detected():
    opening_range = [{"o": 100, "h": 103, "l": 99, "c": 101, "v": 500000}] * 3
    breakout = [{"o": 103, "h": 108, "l": 102, "c": 107, "v": 1800000}]
    df = make_candles(opening_range + breakout)
    result = detect(df, orb_candles=3)
    assert result.detected is True
    assert result.direction == "bullish"

def test_orb_bearish_breakdown():
    opening_range = [{"o": 100, "h": 103, "l": 99, "c": 101, "v": 500000}] * 3
    breakdown = [{"o": 99, "h": 100, "l": 95, "c": 96, "v": 1800000}]
    df = make_candles(opening_range + breakdown)
    result = detect(df, orb_candles=3)
    assert result.detected is True
    assert result.direction == "bearish"

def test_orb_not_detected_without_breakout():
    candles = [{"o": 100, "h": 103, "l": 99, "c": 101, "v": 500000}] * 4
    df = make_candles(candles)
    result = detect(df, orb_candles=3)
    assert result.detected is False

def test_orb_needs_enough_candles():
    df = make_candles([{"o": 100, "h": 103, "l": 99, "c": 101}] * 2)
    result = detect(df, orb_candles=3)
    assert result.detected is False

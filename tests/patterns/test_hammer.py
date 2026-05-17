from tests.patterns.conftest import make_candles
from backend.patterns.hammer import detect

def test_hammer_detected():
    # Small body near top, long lower wick (>2x body), small upper wick
    df = make_candles([
        {"o": 100, "h": 101, "l": 90, "c": 100.5, "v": 2000000},
    ] * 5)
    result = detect(df)
    assert result.detected is True
    assert result.direction == "bullish"
    assert result.confidence > 0

def test_hammer_not_detected_regular_candle():
    # Symmetric wicks — not a hammer
    df = make_candles([
        {"o": 100, "h": 108, "l": 92, "c": 103},  # symmetric, large body
    ] * 5)
    result = detect(df)
    assert result.detected is False

def test_hammer_needs_minimum_candles():
    df = make_candles([{"o": 100, "h": 101, "l": 90, "c": 100.5}])
    result = detect(df)
    assert result.detected is False

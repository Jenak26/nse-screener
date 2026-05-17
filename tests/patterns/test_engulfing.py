from tests.patterns.conftest import make_candles
from backend.patterns.engulfing import detect

def test_bullish_engulfing_detected():
    df = make_candles([
        {"o": 105, "h": 106, "l": 103, "c": 103, "v": 800000},   # bearish prev
        {"o": 102, "h": 109, "l": 101, "c": 108, "v": 1800000},  # bullish, engulfs
    ])
    result = detect(df)
    assert result.detected is True
    assert result.direction == "bullish"

def test_bullish_engulfing_not_detected_if_not_engulfing():
    df = make_candles([
        {"o": 105, "h": 106, "l": 103, "c": 103},
        {"o": 104, "h": 105, "l": 103, "c": 104.5},  # bullish but small
    ])
    result = detect(df)
    assert result.detected is False

def test_bullish_engulfing_needs_two_candles():
    df = make_candles([{"o": 105, "h": 106, "l": 103, "c": 103}])
    result = detect(df)
    assert result.detected is False

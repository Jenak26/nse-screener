from tests.patterns.conftest import make_candles
from backend.patterns.gap_up import detect

def test_gap_up_detected():
    prev = [{"o": 100, "h": 102, "l": 99, "c": 101, "v": 800000}]
    curr = [{"o": 102.5, "h": 108, "l": 102, "c": 106, "v": 1_600_000}]  # 1.5% gap up
    df = make_candles(prev + curr)
    result = detect(df)
    assert result.detected is True
    assert result.direction == "bullish"

def test_gap_up_not_detected_small_gap():
    prev = [{"o": 100, "h": 102, "l": 99, "c": 101, "v": 800000}]
    curr = [{"o": 101.2, "h": 102, "l": 100, "c": 101.5, "v": 900000}]  # 0.2% gap
    df = make_candles(prev + curr)
    result = detect(df)
    assert result.detected is False

def test_gap_up_needs_two_candles():
    df = make_candles([{"o": 100, "h": 102, "l": 99, "c": 101}])
    result = detect(df)
    assert result.detected is False

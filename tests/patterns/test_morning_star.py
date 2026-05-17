from tests.patterns.conftest import make_candles
from backend.patterns.morning_star import detect

def test_morning_star_detected():
    df = make_candles([
        {"o": 110, "h": 111, "l": 108, "c": 108, "v": 1000000},  # bearish
        {"o": 107, "h": 108, "l": 106, "c": 107.2, "v": 600000}, # small body
        {"o": 108, "h": 115, "l": 107, "c": 114, "v": 1800000},  # bullish above midpoint
    ])
    result = detect(df)
    assert result.detected is True
    assert result.direction == "bullish"

def test_morning_star_needs_three_candles():
    df = make_candles([{"o": 110, "h": 111, "l": 108, "c": 108}] * 2)
    result = detect(df)
    assert result.detected is False

def test_morning_star_fails_if_third_candle_too_weak():
    df = make_candles([
        {"o": 110, "h": 111, "l": 108, "c": 108},   # bearish, body = 2
        {"o": 107, "h": 108, "l": 106, "c": 107},   # small body
        {"o": 108, "h": 109, "l": 107, "c": 108.5}, # only reaches 108.5, midpoint is 109
    ])
    result = detect(df)
    assert result.detected is False

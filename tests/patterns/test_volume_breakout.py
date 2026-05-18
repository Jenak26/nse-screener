from tests.patterns.conftest import make_candles
from backend.patterns.volume_breakout import detect

def test_volume_breakout_detected():
    normal = [{"o": 100, "h": 102, "l": 99, "c": 101, "v": 500000}] * 20
    breakout = [{"o": 101, "h": 107, "l": 100, "c": 106, "v": 1_600_000}]  # 3.2x avg, bullish
    df = make_candles(normal + breakout)
    result = detect(df)
    assert result.detected is True
    assert result.direction == "bullish"

def test_volume_breakout_not_on_bearish():
    normal = [{"o": 100, "h": 102, "l": 99, "c": 101, "v": 500000}] * 20
    high_vol_bearish = [{"o": 106, "h": 107, "l": 100, "c": 101, "v": 1_600_000}]
    df = make_candles(normal + high_vol_bearish)
    result = detect(df)
    assert result.detected is False

def test_volume_breakout_needs_enough_candles():
    df = make_candles([{"o": 100, "h": 102, "l": 99, "c": 101, "v": 500000}] * 5)
    result = detect(df)
    assert result.detected is False

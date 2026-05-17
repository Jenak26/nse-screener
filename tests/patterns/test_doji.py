from tests.patterns.conftest import make_candles
from backend.patterns.doji import detect

def test_doji_detected():
    # Body < 10% of total range
    df = make_candles([{"o": 100.0, "h": 105.0, "l": 95.0, "c": 100.2}] * 3)
    result = detect(df)
    assert result.detected is True
    assert result.direction == "neutral"

def test_doji_not_detected_on_large_body():
    df = make_candles([{"o": 100, "h": 110, "l": 95, "c": 108}] * 3)
    result = detect(df)
    assert result.detected is False

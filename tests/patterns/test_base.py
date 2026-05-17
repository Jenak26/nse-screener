from backend.patterns.base import PatternResult

def test_pattern_result_detected():
    r = PatternResult(detected=True, confidence=85, direction="bullish", metadata={"wick": 2.1})
    assert r.detected is True
    assert r.confidence == 85
    assert r.direction == "bullish"

def test_pattern_result_not_detected():
    r = PatternResult(detected=False, confidence=0, direction="neutral")
    assert r.detected is False
    assert r.metadata == {}

def test_pattern_result_clamps_confidence():
    r = PatternResult(detected=True, confidence=150, direction="bullish")
    assert r.confidence <= 100

def test_pattern_result_clamps_negative():
    r = PatternResult(detected=True, confidence=-10, direction="neutral")
    assert r.confidence == 0

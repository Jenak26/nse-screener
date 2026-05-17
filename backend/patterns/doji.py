import pandas as pd
from backend.patterns.base import PatternResult

def detect(candles: pd.DataFrame) -> PatternResult:
    if len(candles) < 1:
        return PatternResult(detected=False, confidence=0, direction="neutral")

    last = candles.iloc[-1]
    body = abs(last["close"] - last["open"])
    total_range = last["high"] - last["low"]

    if total_range == 0:
        return PatternResult(detected=False, confidence=0, direction="neutral")

    body_ratio = body / total_range

    if body_ratio <= 0.10:
        confidence = min(100, int(55 + (0.10 - body_ratio) * 300))
        return PatternResult(
            detected=True, confidence=confidence, direction="neutral",
            metadata={"body_ratio": round(body_ratio, 3)}
        )
    return PatternResult(detected=False, confidence=0, direction="neutral")

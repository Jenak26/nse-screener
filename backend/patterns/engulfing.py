import pandas as pd
from backend.patterns.base import PatternResult

def detect(candles: pd.DataFrame) -> PatternResult:
    if len(candles) < 2:
        return PatternResult(detected=False, confidence=0, direction="neutral")

    prev = candles.iloc[-2]
    curr = candles.iloc[-1]

    prev_bearish = prev["close"] < prev["open"]
    curr_bullish = curr["close"] > curr["open"]

    if not prev_bearish or not curr_bullish:
        return PatternResult(detected=False, confidence=0, direction="neutral")

    engulfs = curr["close"] > prev["open"] and curr["open"] < prev["close"]

    if engulfs:
        avg_vol = candles["volume"].iloc[:-1].mean()
        vol_ratio = curr["volume"] / avg_vol if avg_vol > 0 else 1
        vol_bonus = min(20, int((vol_ratio - 1) * 12)) if vol_ratio > 1 else 0
        prev_body = prev["open"] - prev["close"]
        curr_body = curr["close"] - curr["open"]
        engulf_size = curr_body / prev_body if prev_body > 0 else 1
        size_bonus = min(15, int((engulf_size - 1) * 10))
        confidence = min(100, 55 + vol_bonus + size_bonus)
        return PatternResult(
            detected=True, confidence=confidence, direction="bullish",
            metadata={"engulf_ratio": round(engulf_size, 2), "vol_ratio": round(vol_ratio, 2)}
        )
    return PatternResult(detected=False, confidence=0, direction="neutral")

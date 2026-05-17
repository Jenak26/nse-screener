import pandas as pd
from backend.patterns.base import PatternResult

def detect(candles: pd.DataFrame) -> PatternResult:
    if len(candles) < 3:
        return PatternResult(detected=False, confidence=0, direction="neutral")

    c1, c2, c3 = candles.iloc[-3], candles.iloc[-2], candles.iloc[-1]

    c1_bearish = c1["close"] < c1["open"]
    c2_small = abs(c2["close"] - c2["open"]) <= 0.3 * abs(c1["close"] - c1["open"])
    c3_bullish = c3["close"] > c3["open"]
    c1_midpoint = (c1["open"] + c1["close"]) / 2
    c3_above_midpoint = c3["close"] > c1_midpoint

    if c1_bearish and c2_small and c3_bullish and c3_above_midpoint:
        avg_vol = candles["volume"].iloc[:-1].mean()
        vol_ratio = c3["volume"] / avg_vol if avg_vol > 0 else 1
        vol_bonus = min(20, int((vol_ratio - 1) * 12)) if vol_ratio > 1 else 0
        confidence = min(100, 60 + vol_bonus)
        return PatternResult(
            detected=True, confidence=confidence, direction="bullish",
            metadata={"vol_ratio": round(vol_ratio, 2)}
        )
    return PatternResult(detected=False, confidence=0, direction="neutral")

import pandas as pd
from backend.patterns.base import PatternResult

MIN_CANDLES = 21
VOL_THRESHOLD = 2.5

def detect(candles: pd.DataFrame) -> PatternResult:
    if len(candles) < MIN_CANDLES:
        return PatternResult(detected=False, confidence=0, direction="neutral")

    last = candles.iloc[-1]
    avg_vol = candles["volume"].iloc[-MIN_CANDLES:-1].mean()

    if avg_vol == 0:
        return PatternResult(detected=False, confidence=0, direction="neutral")

    vol_ratio = last["volume"] / avg_vol
    is_bullish = last["close"] > last["open"]

    if vol_ratio >= VOL_THRESHOLD and is_bullish:
        vol_bonus = min(25, int((vol_ratio - VOL_THRESHOLD) * 8))
        confidence = min(100, 55 + vol_bonus)
        return PatternResult(
            detected=True, confidence=confidence, direction="bullish",
            metadata={"vol_ratio": round(vol_ratio, 2), "avg_vol": int(avg_vol)}
        )
    return PatternResult(detected=False, confidence=0, direction="neutral")

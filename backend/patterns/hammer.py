import pandas as pd
from backend.patterns.base import PatternResult

MIN_CANDLES = 3

def detect(candles: pd.DataFrame) -> PatternResult:
    if len(candles) < MIN_CANDLES:
        return PatternResult(detected=False, confidence=0, direction="neutral")

    last = candles.iloc[-1]
    body = abs(last["close"] - last["open"])
    total_range = last["high"] - last["low"]

    if total_range == 0 or body == 0:
        return PatternResult(detected=False, confidence=0, direction="neutral")

    lower_wick = min(last["open"], last["close"]) - last["low"]
    upper_wick = last["high"] - max(last["open"], last["close"])

    is_bullish_close = last["close"] > last["open"]
    long_lower_wick = lower_wick >= 2 * body
    small_upper_wick = upper_wick <= 0.3 * total_range
    small_body = body <= 0.35 * total_range

    if long_lower_wick and small_upper_wick and small_body:
        avg_vol = candles["volume"].iloc[:-1].mean()
        vol_ratio = last["volume"] / avg_vol if avg_vol > 0 else 1
        base_score = 55 if is_bullish_close else 45
        vol_bonus = min(20, int((vol_ratio - 1) * 15)) if vol_ratio > 1 else 0
        confidence = min(100, base_score + vol_bonus)
        return PatternResult(
            detected=True, confidence=confidence, direction="bullish",
            metadata={"lower_wick_ratio": round(lower_wick / body, 2), "vol_ratio": round(vol_ratio, 2)}
        )
    return PatternResult(detected=False, confidence=0, direction="neutral")

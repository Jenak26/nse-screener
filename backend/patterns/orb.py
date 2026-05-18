import pandas as pd
from backend.patterns.base import PatternResult

def detect(candles: pd.DataFrame, orb_candles: int = 3) -> PatternResult:
    """Detect Opening Range Breakout."""
    if len(candles) < orb_candles + 1:
        return PatternResult(detected=False, confidence=0, direction="neutral")

    opening_range = candles.iloc[:orb_candles]
    orb_high = opening_range["high"].max()
    orb_low = opening_range["low"].min()
    current = candles.iloc[-1]
    orb_range = orb_high - orb_low if (orb_high - orb_low) > 0 else 1

    if current["close"] > orb_high:
        avg_vol = candles["volume"].iloc[:orb_candles].mean()
        vol_ratio = current["volume"] / avg_vol if avg_vol > 0 else 1
        breakout_strength = (current["close"] - orb_high) / orb_range
        vol_bonus = min(25, int((vol_ratio - 1) * 15)) if vol_ratio > 1.5 else 0
        strength_bonus = min(15, int(breakout_strength * 50))
        confidence = min(100, 55 + vol_bonus + strength_bonus)
        return PatternResult(
            detected=True, confidence=confidence, direction="bullish",
            metadata={"orb_high": orb_high, "orb_low": orb_low, "vol_ratio": round(vol_ratio, 2)}
        )

    if current["close"] < orb_low:
        avg_vol = candles["volume"].iloc[:orb_candles].mean()
        vol_ratio = current["volume"] / avg_vol if avg_vol > 0 else 1
        vol_bonus = min(25, int((vol_ratio - 1) * 15)) if vol_ratio > 1.5 else 0
        confidence = min(100, 55 + vol_bonus)
        return PatternResult(
            detected=True, confidence=confidence, direction="bearish",
            metadata={"orb_high": orb_high, "orb_low": orb_low, "vol_ratio": round(vol_ratio, 2)}
        )

    return PatternResult(detected=False, confidence=0, direction="neutral")

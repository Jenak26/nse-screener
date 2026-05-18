import pandas as pd
from backend.patterns.base import PatternResult

GAP_THRESHOLD = 0.005  # 0.5%

def detect(candles: pd.DataFrame) -> PatternResult:
    if len(candles) < 2:
        return PatternResult(detected=False, confidence=0, direction="neutral")

    prev = candles.iloc[-2]
    curr = candles.iloc[-1]

    if prev["close"] <= 0:
        return PatternResult(detected=False, confidence=0, direction="neutral")

    gap_pct = (curr["open"] - prev["close"]) / prev["close"]

    if gap_pct >= GAP_THRESHOLD and curr["close"] > curr["open"]:
        avg_vol = candles["volume"].iloc[:-1].mean()
        vol_ratio = curr["volume"] / avg_vol if avg_vol > 0 else 1
        vol_bonus = min(20, int((vol_ratio - 1) * 12)) if vol_ratio > 1 else 0
        gap_bonus = min(15, int(gap_pct * 500))
        confidence = min(100, 55 + vol_bonus + gap_bonus)
        return PatternResult(
            detected=True, confidence=confidence, direction="bullish",
            metadata={"gap_pct": round(gap_pct * 100, 2), "vol_ratio": round(vol_ratio, 2)}
        )
    return PatternResult(detected=False, confidence=0, direction="neutral")

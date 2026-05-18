import pandas as pd
from backend.indicators.vwap import calculate_vwap
from backend.patterns.base import PatternResult

MIN_CANDLES = 15

def detect(candles: pd.DataFrame) -> PatternResult:
    if len(candles) < MIN_CANDLES:
        return PatternResult(detected=False, confidence=0, direction="neutral")

    vwap = calculate_vwap(candles)
    current = candles.iloc[-1]
    prev = candles.iloc[-2]
    current_vwap = vwap.iloc[-1]

    if current_vwap <= 0:
        return PatternResult(detected=False, confidence=0, direction="neutral")

    # Price came close to VWAP (within 0.5%)
    prev_low_near_vwap = abs(prev["low"] - current_vwap) / current_vwap <= 0.005

    # Current candle bullish and closes above VWAP
    curr_bullish = current["close"] > current["open"]
    curr_above_vwap = current["close"] > current_vwap

    # Volume confirmation
    avg_vol = candles["volume"].iloc[-10:-1].mean()
    vol_ratio = current["volume"] / avg_vol if avg_vol > 0 else 1

    if prev_low_near_vwap and curr_bullish and curr_above_vwap and vol_ratio >= 1.5:
        vol_bonus = min(20, int((vol_ratio - 1.5) * 15))
        confidence = min(100, 60 + vol_bonus)
        return PatternResult(
            detected=True, confidence=confidence, direction="bullish",
            metadata={"vwap": round(current_vwap, 2), "vol_ratio": round(vol_ratio, 2)}
        )
    return PatternResult(detected=False, confidence=0, direction="neutral")

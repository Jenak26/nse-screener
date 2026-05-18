import pandas as pd

def calculate_vwap(candles: pd.DataFrame) -> pd.Series:
    """Calculate VWAP from a candles DataFrame. Assumes intraday session."""
    typical_price = (candles["high"] + candles["low"] + candles["close"]) / 3
    cumulative_tp_vol = (typical_price * candles["volume"]).cumsum()
    cumulative_vol = candles["volume"].cumsum()
    vwap = cumulative_tp_vol / cumulative_vol
    return vwap

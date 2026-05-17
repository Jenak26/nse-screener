import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")

TIMEFRAME_MAP = {
    "5m":    ("5m",  "1d"),
    "15m":   ("15m", "5d"),
    "1H":    ("1h",  "30d"),
    "Daily": ("1d",  "365d"),
    "Weekly":("1wk", "730d"),
}


def fetch_candles(symbol: str, timeframe: str, days: int | None = None) -> pd.DataFrame:
    """Fetch OHLCV candles from yfinance. Returns DataFrame with lowercase columns + timestamp."""
    yf_interval, default_period = TIMEFRAME_MAP.get(timeframe, ("1d", "365d"))
    ticker = f"{symbol}.NS"
    try:
        tk = yf.Ticker(ticker)
        if days:
            end = datetime.now(IST)
            start = end - timedelta(days=days)
            hist = tk.history(interval=yf_interval, start=start, end=end)
        else:
            hist = tk.history(interval=yf_interval, period=default_period)

        if hist.empty:
            return pd.DataFrame()

        df = hist[["Open", "High", "Low", "Close", "Volume"]].copy()
        df.columns = ["open", "high", "low", "close", "volume"]
        df.index = pd.to_datetime(df.index)
        df["timestamp"] = df.index.astype(int) // 10**9  # Unix epoch seconds
        df = df.reset_index(drop=True)
        return df
    except Exception:
        return pd.DataFrame()

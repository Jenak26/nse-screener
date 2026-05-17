import pandas as pd
import pytest
from unittest.mock import patch, MagicMock
from backend.data_fetcher.yfinance_client import fetch_candles, TIMEFRAME_MAP


def _mock_history(rows=5):
    import numpy as np
    dates = pd.date_range("2024-01-01", periods=rows, freq="D")
    return pd.DataFrame({
        "Open": np.random.uniform(100, 200, rows),
        "High": np.random.uniform(200, 300, rows),
        "Low": np.random.uniform(50, 100, rows),
        "Close": np.random.uniform(100, 200, rows),
        "Volume": np.random.randint(100000, 10000000, rows),
    }, index=dates)


def test_fetch_candles_returns_dataframe():
    with patch("yfinance.Ticker") as MockTicker:
        MockTicker.return_value.history.return_value = _mock_history(5)
        df = fetch_candles("RELIANCE", "Daily", days=5)
    assert isinstance(df, pd.DataFrame)
    assert set(["open", "high", "low", "close", "volume", "timestamp"]).issubset(df.columns)


def test_fetch_candles_empty_returns_empty_df():
    with patch("yfinance.Ticker") as MockTicker:
        MockTicker.return_value.history.return_value = pd.DataFrame()
        df = fetch_candles("FAKE", "Daily", days=5)
    assert df.empty


def test_timeframe_map_has_required_keys():
    assert "5m" in TIMEFRAME_MAP
    assert "15m" in TIMEFRAME_MAP
    assert "1H" in TIMEFRAME_MAP
    assert "Daily" in TIMEFRAME_MAP
    assert "Weekly" in TIMEFRAME_MAP

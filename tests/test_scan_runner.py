import os
os.environ["DB_PATH"] = ":memory:"
os.environ["STOCK_UNIVERSE_PATH"] = "tests/data_fetcher/sample_nifty500.csv"

import pandas as pd
import pytest
from unittest.mock import patch
from database.db import init_db
from backend.scanners.scan_runner import run_scan_for_symbol

def _make_df(n=25):
    import numpy as np
    return pd.DataFrame({
        "open":  np.linspace(100, 110, n),
        "high":  np.linspace(102, 112, n),
        "low":   np.linspace(98, 108, n),
        "close": np.linspace(101, 111, n),
        "volume": [1_000_000] * n,
        "timestamp": list(range(n)),
    })

@pytest.fixture(autouse=True)
def fresh_db():
    # Reset engine for in-memory isolation
    import database.db as db_module
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    db_module.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    db_module.SessionLocal = sessionmaker(bind=db_module.engine)
    init_db()

def test_run_scan_for_symbol_no_crash():
    with patch("backend.scanners.scan_runner.get_candles_from_db", return_value=_make_df(25)):
        run_scan_for_symbol("RELIANCE", ["Daily"])
    # Just confirm it ran without error

def test_run_scan_empty_candles_no_crash():
    with patch("backend.scanners.scan_runner.get_candles_from_db", return_value=pd.DataFrame()):
        run_scan_for_symbol("RELIANCE", ["Daily"])

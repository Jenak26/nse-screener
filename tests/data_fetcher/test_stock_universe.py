import os, pytest, pandas as pd
os.environ["DB_PATH"] = ":memory:"
os.environ["STOCK_UNIVERSE_PATH"] = "tests/data_fetcher/sample_nifty500.csv"

from database.db import init_db
from backend.data_fetcher.stock_universe import load_stock_universe, get_all_symbols, get_fno_symbols

@pytest.fixture(autouse=True)
def fresh_db():
    init_db()

def test_load_stock_universe_populates_db():
    load_stock_universe()
    symbols = get_all_symbols()
    assert "RELIANCE" in symbols
    assert "TCS" in symbols
    assert len(symbols) == 3

def test_fno_symbols_returns_subset():
    load_stock_universe()
    fno = get_fno_symbols()
    assert isinstance(fno, list)
    # RELIANCE is in FNO_SYMBOLS, so at least 1 result
    assert "RELIANCE" in fno

def test_load_is_idempotent():
    load_stock_universe()
    load_stock_universe()  # Should not raise or create duplicates
    symbols = get_all_symbols()
    assert len(symbols) == 3

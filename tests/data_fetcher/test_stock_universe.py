import pytest
import pandas as pd
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

SAMPLE_CSV = "tests/data_fetcher/sample_nifty500.csv"

@pytest.fixture(autouse=True)
def fresh_db():
    """Provide a clean in-memory DB for each test."""
    import database.db as db_module
    from database.models import Base
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    db_module.engine = engine
    db_module.SessionLocal = sessionmaker(bind=engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)

def test_load_stock_universe_populates_db():
    from backend.data_fetcher.stock_universe import load_stock_universe, get_all_symbols
    load_stock_universe(path=SAMPLE_CSV)
    symbols = get_all_symbols()
    assert "RELIANCE" in symbols
    assert "TCS" in symbols
    assert len(symbols) == 3

def test_fno_symbols_returns_subset():
    from backend.data_fetcher.stock_universe import load_stock_universe, get_fno_symbols
    load_stock_universe(path=SAMPLE_CSV)
    fno = get_fno_symbols()
    assert isinstance(fno, list)
    assert "RELIANCE" in fno

def test_load_is_idempotent():
    from backend.data_fetcher.stock_universe import load_stock_universe, get_all_symbols
    load_stock_universe(path=SAMPLE_CSV)
    load_stock_universe(path=SAMPLE_CSV)
    symbols = get_all_symbols()
    assert len(symbols) == 3

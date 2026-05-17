import os, pytest
os.environ["DB_PATH"] = ":memory:"

from database.db import init_db, get_session
from database.models import Stock, Candle, DetectedPattern, SectorStrength, Alert

def test_init_creates_all_tables():
    init_db()
    session = get_session()
    session.add(Stock(symbol="RELIANCE", company_name="Reliance Industries", sector="Energy", is_fno=1))
    session.commit()
    result = session.query(Stock).filter_by(symbol="RELIANCE").first()
    assert result is not None
    assert result.sector == "Energy"
    session.close()

def test_candle_unique_constraint():
    init_db()
    session = get_session()
    from sqlalchemy.exc import IntegrityError
    c1 = Candle(symbol="TCS", timeframe="Daily", timestamp=1700000000, open=3500, high=3550, low=3480, close=3530, volume=1000000)
    c2 = Candle(symbol="TCS", timeframe="Daily", timestamp=1700000000, open=3500, high=3550, low=3480, close=3530, volume=1000000)
    session.add(c1)
    session.commit()
    session.add(c2)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()
    session.close()

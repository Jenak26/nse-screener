import os
import time
os.environ["DB_PATH"] = ":memory:"
os.environ["TELEGRAM_BOT_TOKEN"] = "fake:token"
os.environ["TELEGRAM_CHAT_ID"] = "123456"
os.environ["ALERT_MIN_CONFIDENCE"] = "70"

import pytest
from database.db import init_db
from backend.alerts.telegram import is_duplicate_alert

@pytest.fixture(autouse=True)
def fresh_db():
    import database.db as db_module
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    db_module.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    db_module.SessionLocal = sessionmaker(bind=db_module.engine)
    init_db()

def test_no_duplicate_on_first_alert():
    assert is_duplicate_alert("RELIANCE", "hammer", "Daily") is False

def test_duplicate_suppression_blocks_repeat():
    from database.db import get_session
    from database.models import Alert
    session = get_session()
    session.add(Alert(
        symbol="RELIANCE", alert_type="hammer|Daily",
        message="test", sent_at=int(time.time())
    ))
    session.commit()
    session.close()
    assert is_duplicate_alert("RELIANCE", "hammer", "Daily") is True

def test_duplicate_suppression_allows_after_expiry():
    from database.db import get_session
    from database.models import Alert
    session = get_session()
    # Alert from 2 hours ago — should NOT be a duplicate
    session.add(Alert(
        symbol="TCS", alert_type="doji|1H",
        message="old alert", sent_at=int(time.time()) - 7200
    ))
    session.commit()
    session.close()
    assert is_duplicate_alert("TCS", "doji", "1H") is False

def test_different_timeframe_not_duplicate():
    from database.db import get_session
    from database.models import Alert
    session = get_session()
    session.add(Alert(
        symbol="HDFCBANK", alert_type="hammer|Daily",
        message="test", sent_at=int(time.time())
    ))
    session.commit()
    session.close()
    # Same symbol+pattern but different timeframe — not a duplicate
    assert is_duplicate_alert("HDFCBANK", "hammer", "1H") is False

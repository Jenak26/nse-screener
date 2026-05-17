from datetime import datetime
from zoneinfo import ZoneInfo
from utils.time_utils import is_market_open, to_ist, market_open_time, market_close_time

IST = ZoneInfo("Asia/Kolkata")

def test_market_open_during_hours():
    t = datetime(2024, 1, 15, 10, 30, tzinfo=IST)  # Monday 10:30 AM IST
    assert is_market_open(t) is True

def test_market_closed_before_open():
    t = datetime(2024, 1, 15, 9, 0, tzinfo=IST)   # Monday 9:00 AM IST
    assert is_market_open(t) is False

def test_market_closed_after_close():
    t = datetime(2024, 1, 15, 15, 31, tzinfo=IST)  # Monday 3:31 PM IST
    assert is_market_open(t) is False

def test_market_closed_on_saturday():
    t = datetime(2024, 1, 13, 11, 0, tzinfo=IST)   # Saturday 11 AM IST
    assert is_market_open(t) is False

def test_to_ist_converts_utc():
    from datetime import timezone
    utc = datetime(2024, 1, 15, 5, 0, tzinfo=timezone.utc)  # 5 AM UTC = 10:30 AM IST
    ist = to_ist(utc)
    assert ist.hour == 10
    assert ist.minute == 30

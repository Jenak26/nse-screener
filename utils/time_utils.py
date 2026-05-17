from datetime import datetime, time
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
_MARKET_OPEN = time(9, 15)
_MARKET_CLOSE = time(15, 30)

def to_ist(dt: datetime) -> datetime:
    return dt.astimezone(IST)

def now_ist() -> datetime:
    return datetime.now(IST)

def is_market_open(dt: datetime | None = None) -> bool:
    dt = to_ist(dt or now_ist())
    if dt.weekday() >= 5:  # Saturday=5, Sunday=6
        return False
    t = dt.time()
    return _MARKET_OPEN <= t <= _MARKET_CLOSE

def market_open_time() -> time:
    return _MARKET_OPEN

def market_close_time() -> time:
    return _MARKET_CLOSE

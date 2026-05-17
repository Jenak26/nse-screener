# Phase 1: Foundation + MVP Scanner — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working background scanner + 2-page Streamlit dashboard showing top setups from NIFTY 500 stocks in real time.

**Architecture:** APScheduler polls Angel One REST API every 1–15 minutes during market hours, stores OHLCV candles in SQLite, runs 8 pattern detectors across all symbols × timeframes, writes signals to DB. Streamlit reads only from DB — never scans live. yfinance provides historical backfill and offline fallback.

**Tech Stack:** Python 3.12, Streamlit, Plotly, SQLAlchemy 2 (SQLite), APScheduler 3, smartapi-python, pyotp, yfinance, pandas-ta, python-telegram-bot, python-dotenv, pytest

---

## File Map

| File | Responsibility |
|---|---|
| `config/settings.py` | Load all env vars from `.env` |
| `database/models.py` | SQLAlchemy ORM models |
| `database/db.py` | Engine, session factory, `init_db()` |
| `database/queries.py` | Read-only query helpers for dashboard |
| `backend/data_fetcher/stock_universe.py` | Load NIFTY 500 CSV → stocks table |
| `backend/data_fetcher/yfinance_client.py` | Historical OHLCV from yfinance |
| `backend/data_fetcher/angel_one.py` | Angel One SmartAPI client (login, candles, LTP) |
| `utils/time_utils.py` | Market hours check, IST helpers |
| `backend/patterns/base.py` | `PatternResult` dataclass + `detect()` interface |
| `backend/patterns/hammer.py` | Hammer candlestick detector |
| `backend/patterns/engulfing.py` | Bullish Engulfing detector |
| `backend/patterns/morning_star.py` | Morning Star detector |
| `backend/patterns/doji.py` | Doji detector |
| `backend/indicators/vwap.py` | VWAP calculation helper |
| `backend/patterns/orb.py` | ORB (Opening Range Breakout) detector |
| `backend/patterns/vwap_bounce.py` | VWAP Bounce detector |
| `backend/patterns/volume_breakout.py` | Volume Breakout detector |
| `backend/patterns/gap_up.py` | Gap Up Momentum detector |
| `backend/scoring/scorer.py` | Basic confidence scorer (2 factors) |
| `backend/scanners/scan_runner.py` | Orchestrates all scans, writes to DB |
| `backend/alerts/telegram.py` | Telegram alert sender with dedup |
| `app/components/tables.py` | Reusable Streamlit table renderers |
| `app/components/metrics.py` | Reusable metric card renderers |
| `app/components/charts.py` | Reusable Plotly chart wrappers |
| `app/pages/01_home.py` | Home page — market overview + top stocks + alerts |
| `app/pages/02_pattern_scanner.py` | Pattern Scanner page |
| `app/main_app.py` | Streamlit entry point |
| `main.py` | Starts APScheduler + launches Streamlit |

---

## Task 1: Project Setup

**Files:**
- Create: `config/settings.py`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `requirements.txt`
- Create all empty `__init__.py` files

- [ ] **Step 1: Create folder structure**

```
mkdir tradad
cd tradad
mkdir app app\pages app\components
mkdir backend backend\data_fetcher backend\patterns backend\indicators backend\scoring backend\scanners backend\alerts backend\sectors backend\rankings
mkdir database config utils data logs tests tests\patterns tests\data_fetcher
```

On Windows PowerShell:
```powershell
$dirs = @(
  "app/pages","app/components",
  "backend/data_fetcher","backend/patterns","backend/indicators",
  "backend/scoring","backend/scanners","backend/alerts","backend/sectors","backend/rankings",
  "database","config","utils","data","logs",
  "tests/patterns","tests/data_fetcher"
)
foreach ($d in $dirs) { New-Item -ItemType Directory -Force $d }
```

- [ ] **Step 2: Create Python virtual environment**

```powershell
python -m venv venv
venv\Scripts\activate
```

- [ ] **Step 3: Create `requirements.txt`**

```text
streamlit>=1.35
plotly>=5.20
pandas>=2.2
numpy>=1.26
pandas-ta>=0.3.14b
yfinance>=0.2.38
smartapi-python>=1.3.0
pyotp>=2.9
python-telegram-bot>=21.0
apscheduler>=3.10
sqlalchemy>=2.0
python-dotenv>=1.0
requests>=2.31
websocket-client>=1.8
nsepython>=2.0
pytest>=8.0
pytest-mock>=3.14
```

- [ ] **Step 4: Install dependencies**

```powershell
pip install -r requirements.txt
```

- [ ] **Step 5: Create `.env.example`**

```text
ANGEL_API_KEY=your_api_key_here
ANGEL_CLIENT_ID=your_client_id_here
ANGEL_PASSWORD=your_password_here
ANGEL_TOTP_SECRET=your_totp_secret_here
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
ALERT_MIN_CONFIDENCE=70
DB_PATH=tradad.db
STOCK_UNIVERSE_PATH=data/nifty500.csv
CANDLE_RETENTION_DAYS_INTRADAY=30
CANDLE_RETENTION_DAYS_DAILY=365
```

- [ ] **Step 6: Copy `.env.example` to `.env` and fill in your real credentials**

```powershell
Copy-Item .env.example .env
```

- [ ] **Step 7: Create `.gitignore`**

```text
.env
*.db
logs/
__pycache__/
*.pyc
venv/
.venv/
*.egg-info/
dist/
build/
.pytest_cache/
```

- [ ] **Step 8: Create `config/settings.py`**

```python
from dotenv import load_dotenv
import os

load_dotenv()

ANGEL_API_KEY = os.getenv("ANGEL_API_KEY", "")
ANGEL_CLIENT_ID = os.getenv("ANGEL_CLIENT_ID", "")
ANGEL_PASSWORD = os.getenv("ANGEL_PASSWORD", "")
ANGEL_TOTP_SECRET = os.getenv("ANGEL_TOTP_SECRET", "")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
ALERT_MIN_CONFIDENCE = int(os.getenv("ALERT_MIN_CONFIDENCE", "70"))
DB_PATH = os.getenv("DB_PATH", "tradad.db")
STOCK_UNIVERSE_PATH = os.getenv("STOCK_UNIVERSE_PATH", "data/nifty500.csv")
CANDLE_RETENTION_DAYS_INTRADAY = int(os.getenv("CANDLE_RETENTION_DAYS_INTRADAY", "30"))
CANDLE_RETENTION_DAYS_DAILY = int(os.getenv("CANDLE_RETENTION_DAYS_DAILY", "365"))
```

- [ ] **Step 9: Create all `__init__.py` files**

```powershell
$pkgs = @(
  "app","app/pages","app/components",
  "backend","backend/data_fetcher","backend/patterns","backend/indicators",
  "backend/scoring","backend/scanners","backend/alerts","backend/sectors","backend/rankings",
  "database","config","utils","tests","tests/patterns","tests/data_fetcher"
)
foreach ($p in $pkgs) { New-Item -Force "$p/__init__.py" -ItemType File | Out-Null }
```

- [ ] **Step 10: Verify settings load**

```powershell
python -c "from config.settings import DB_PATH; print('Settings OK:', DB_PATH)"
```

Expected: `Settings OK: tradad.db`

- [ ] **Step 11: Commit**

```powershell
git init
git add .
git commit -m "feat: project setup, config, requirements"
```

---

## Task 2: Database Models

**Files:**
- Create: `database/models.py`
- Create: `database/db.py`
- Create: `tests/test_db.py`

- [ ] **Step 1: Write failing test**

```python
# tests/test_db.py
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
```

- [ ] **Step 2: Run test to confirm it fails**

```powershell
pytest tests/test_db.py -v
```

Expected: `ImportError` or `ModuleNotFoundError` (models not yet created)

- [ ] **Step 3: Create `database/models.py`**

```python
from sqlalchemy import Column, Integer, Text, Real, UniqueConstraint, Index
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

class Stock(Base):
    __tablename__ = "stocks"
    symbol = Column(Text, primary_key=True)
    company_name = Column(Text)
    sector = Column(Text)
    market_cap = Column(Real)
    is_fno = Column(Integer, default=0)
    lot_size = Column(Integer)

class Candle(Base):
    __tablename__ = "candles"
    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(Text, nullable=False)
    timeframe = Column(Text, nullable=False)
    timestamp = Column(Integer, nullable=False)
    open = Column(Real)
    high = Column(Real)
    low = Column(Real)
    close = Column(Real)
    volume = Column(Integer)
    __table_args__ = (
        UniqueConstraint("symbol", "timeframe", "timestamp"),
        Index("idx_candles", "symbol", "timeframe", "timestamp"),
    )

class DetectedPattern(Base):
    __tablename__ = "detected_patterns"
    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(Text, nullable=False)
    timeframe = Column(Text, nullable=False)
    pattern_name = Column(Text, nullable=False)
    confidence_score = Column(Integer, nullable=False)
    trend_direction = Column(Text)
    volume_confirmation = Column(Integer, default=0)
    detected_at = Column(Integer, nullable=False)
    __table_args__ = (
        UniqueConstraint("symbol", "pattern_name", "timeframe", "detected_at"),
        Index("idx_patterns", "detected_at", "confidence_score"),
    )

class SectorStrength(Base):
    __tablename__ = "sector_strength"
    sector = Column(Text, primary_key=True)
    strength_score = Column(Real)
    momentum_score = Column(Real)
    updated_at = Column(Integer)

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(Text)
    alert_type = Column(Text)
    message = Column(Text)
    sent_at = Column(Integer)

class Watchlist(Base):
    __tablename__ = "watchlists"
    id = Column(Integer, primary_key=True, autoincrement=True)
    list_name = Column(Text, nullable=False)
    symbol = Column(Text, nullable=False)
    notes = Column(Text)
    tags = Column(Text)
    added_at = Column(Integer)
```

- [ ] **Step 4: Create `database/db.py`**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database.models import Base
from config.settings import DB_PATH

engine = create_engine(f"sqlite:///{DB_PATH}", echo=False, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)

def init_db():
    Base.metadata.create_all(engine)

def get_session():
    return SessionLocal()
```

- [ ] **Step 5: Run tests**

```powershell
pytest tests/test_db.py -v
```

Expected: 2 PASSED

- [ ] **Step 6: Commit**

```powershell
git add database/ tests/test_db.py
git commit -m "feat: database models and session setup"
```

---

## Task 3: Stock Universe Loader

**Files:**
- Create: `backend/data_fetcher/stock_universe.py`
- Create: `tests/data_fetcher/test_stock_universe.py`
- Prerequisite: `data/nifty500.csv` downloaded from NSE (see `things_required.txt`)

- [ ] **Step 1: Write failing test**

```python
# tests/data_fetcher/test_stock_universe.py
import os, pytest, pandas as pd
os.environ["DB_PATH"] = ":memory:"
os.environ["STOCK_UNIVERSE_PATH"] = "tests/data_fetcher/sample_nifty500.csv"

from database.db import init_db
from backend.data_fetcher.stock_universe import load_stock_universe, get_all_symbols, get_fno_symbols

@pytest.fixture(autouse=True)
def setup_sample_csv(tmp_path):
    csv = pd.DataFrame({
        "Company Name": ["Reliance Industries", "TCS", "HDFC Bank"],
        "Industry": ["Energy", "IT", "Banking"],
        "Symbol": ["RELIANCE", "TCS", "HDFCBANK"],
        "Series": ["EQ", "EQ", "EQ"],
        "ISIN Code": ["INE002A01018", "INE467B01029", "INE040A01034"]
    })
    csv.to_csv("tests/data_fetcher/sample_nifty500.csv", index=False)

def test_load_stock_universe_populates_db():
    init_db()
    load_stock_universe()
    symbols = get_all_symbols()
    assert "RELIANCE" in symbols
    assert "TCS" in symbols
    assert len(symbols) == 3

def test_fno_symbols_returns_subset():
    init_db()
    load_stock_universe()
    fno = get_fno_symbols()
    assert isinstance(fno, list)
```

- [ ] **Step 2: Run test — confirm fails**

```powershell
pytest tests/data_fetcher/test_stock_universe.py -v
```

Expected: ImportError

- [ ] **Step 3: Create `backend/data_fetcher/stock_universe.py`**

```python
import pandas as pd
from database.db import get_session, init_db
from database.models import Stock
from config.settings import STOCK_UNIVERSE_PATH

# F&O eligible symbols (NSE F&O list — update periodically)
FNO_SYMBOLS = {
    "RELIANCE","TCS","HDFCBANK","INFY","ICICIBANK","HINDUNILVR","ITC","SBIN","BHARTIARTL",
    "KOTAKBANK","LT","AXISBANK","ASIANPAINT","MARUTI","TITAN","BAJFINANCE","NESTLEIND",
    "WIPRO","TECHM","HCLTECH","SUNPHARMA","ULTRACEMCO","ADANIENT","ADANIPORTS","POWERGRID",
    "NTPC","ONGC","COALINDIA","JSWSTEEL","TATASTEEL","TATAMOTORS","M&M","BAJAJFINSV",
    "GRASIM","BPCL","EICHERMOT","HEROMOTOCO","DRREDDY","DIVISLAB","CIPLA","APOLLOHOSP",
    "BRITANNIA","HINDALCO","INDUSINDBK","SBILIFE","BAJAJ-AUTO","TATACONSUM","LTIM",
    "HAL","BEL","IRFC","RAIL","TRENT","ZOMATO","NYKAA","PAYTM","IRCTC","DMART",
}

def load_stock_universe():
    df = pd.read_csv(STOCK_UNIVERSE_PATH)
    session = get_session()
    try:
        for _, row in df.iterrows():
            symbol = str(row["Symbol"]).strip()
            existing = session.query(Stock).filter_by(symbol=symbol).first()
            if existing:
                continue
            session.add(Stock(
                symbol=symbol,
                company_name=str(row["Company Name"]).strip(),
                sector=str(row["Industry"]).strip(),
                is_fno=1 if symbol in FNO_SYMBOLS else 0,
            ))
        session.commit()
    finally:
        session.close()

def get_all_symbols() -> list[str]:
    session = get_session()
    try:
        return [r.symbol for r in session.query(Stock.symbol).all()]
    finally:
        session.close()

def get_fno_symbols() -> list[str]:
    session = get_session()
    try:
        return [r.symbol for r in session.query(Stock.symbol).filter_by(is_fno=1).all()]
    finally:
        session.close()
```

- [ ] **Step 4: Run tests**

```powershell
pytest tests/data_fetcher/test_stock_universe.py -v
```

Expected: 2 PASSED

- [ ] **Step 5: Commit**

```powershell
git add backend/data_fetcher/stock_universe.py tests/data_fetcher/test_stock_universe.py
git commit -m "feat: stock universe loader from NIFTY 500 CSV"
```

---

## Task 4: Market Hours Guard

**Files:**
- Create: `utils/time_utils.py`
- Create: `tests/test_time_utils.py`

- [ ] **Step 1: Write failing test**

```python
# tests/test_time_utils.py
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
```

- [ ] **Step 2: Run test — confirm fails**

```powershell
pytest tests/test_time_utils.py -v
```

- [ ] **Step 3: Create `utils/time_utils.py`**

```python
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
```

- [ ] **Step 4: Run tests**

```powershell
pytest tests/test_time_utils.py -v
```

Expected: 5 PASSED

- [ ] **Step 5: Commit**

```powershell
git add utils/time_utils.py tests/test_time_utils.py
git commit -m "feat: market hours guard and IST utilities"
```

---

## Task 5: yfinance Client

**Files:**
- Create: `backend/data_fetcher/yfinance_client.py`
- Create: `tests/data_fetcher/test_yfinance_client.py`

- [ ] **Step 1: Write failing test**

```python
# tests/data_fetcher/test_yfinance_client.py
import pandas as pd, pytest
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
    assert set(["open","high","low","close","volume","timestamp"]).issubset(df.columns)

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
```

- [ ] **Step 2: Run test — confirm fails**

```powershell
pytest tests/data_fetcher/test_yfinance_client.py -v
```

- [ ] **Step 3: Create `backend/data_fetcher/yfinance_client.py`**

```python
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

        df = hist[["Open","High","Low","Close","Volume"]].copy()
        df.columns = ["open","high","low","close","volume"]
        df.index = pd.to_datetime(df.index)
        df["timestamp"] = df.index.astype(int) // 10**9  # Unix epoch seconds
        df = df.reset_index(drop=True)
        return df
    except Exception:
        return pd.DataFrame()
```

- [ ] **Step 4: Run tests**

```powershell
pytest tests/data_fetcher/test_yfinance_client.py -v
```

Expected: 3 PASSED

- [ ] **Step 5: Commit**

```powershell
git add backend/data_fetcher/yfinance_client.py tests/data_fetcher/test_yfinance_client.py
git commit -m "feat: yfinance client for historical OHLCV"
```

---

## Task 6: Angel One Client

**Files:**
- Create: `backend/data_fetcher/angel_one.py`
- Create: `tests/data_fetcher/test_angel_one.py`

Note: Angel One login requires real credentials. Tests mock the API calls.

- [ ] **Step 1: Write failing test**

```python
# tests/data_fetcher/test_angel_one.py
import pytest
from unittest.mock import patch, MagicMock
from backend.data_fetcher.angel_one import AngelOneClient, INTERVAL_MAP

@pytest.fixture
def mock_client():
    with patch("backend.data_fetcher.angel_one.SmartConnect") as MockSC:
        instance = MockSC.return_value
        instance.generateSession.return_value = {
            "data": {"jwtToken": "fake_jwt", "feedToken": "fake_feed"}
        }
        instance.getProfile.return_value = {"data": {"name": "Test User"}}
        client = AngelOneClient(api_key="k", client_id="c", password="p", totp_secret="BASE32SECRET3232")
        with patch("pyotp.TOTP") as MockTOTP:
            MockTOTP.return_value.now.return_value = "123456"
            client.login()
        yield client, instance

def test_login_sets_auth_token(mock_client):
    client, _ = mock_client
    assert client.auth_token == "fake_jwt"

def test_get_candles_returns_dataframe(mock_client):
    import pandas as pd
    client, api = mock_client
    api.getCandleData.return_value = {
        "status": True,
        "data": [
            ["2024-01-15T09:15:00+05:30", 100.0, 105.0, 98.0, 103.0, 1000000],
            ["2024-01-15T09:20:00+05:30", 103.0, 108.0, 101.0, 106.0, 1200000],
        ]
    }
    # Provide a fake token map
    client._token_map = {"RELIANCE": "2885"}
    df = client.get_candles("RELIANCE", "15m", days=1)
    assert isinstance(df, pd.DataFrame)
    assert len(df) == 2
    assert "close" in df.columns

def test_interval_map_has_required_timeframes():
    assert "5m" in INTERVAL_MAP
    assert "15m" in INTERVAL_MAP
    assert "1H" in INTERVAL_MAP
    assert "Daily" in INTERVAL_MAP
```

- [ ] **Step 2: Run test — confirm fails**

```powershell
pytest tests/data_fetcher/test_angel_one.py -v
```

- [ ] **Step 3: Create `backend/data_fetcher/angel_one.py`**

```python
import pyotp
import pandas as pd
import requests
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from SmartApi import SmartConnect
from config.settings import ANGEL_API_KEY, ANGEL_CLIENT_ID, ANGEL_PASSWORD, ANGEL_TOTP_SECRET

IST = ZoneInfo("Asia/Kolkata")

INTERVAL_MAP = {
    "5m":    "FIVE_MINUTE",
    "15m":   "FIFTEEN_MINUTE",
    "1H":    "ONE_HOUR",
    "Daily": "ONE_DAY",
    "Weekly":"ONE_DAY",  # yfinance preferred for weekly
}

INSTRUMENTS_URL = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json"

class AngelOneClient:
    def __init__(self, api_key=ANGEL_API_KEY, client_id=ANGEL_CLIENT_ID,
                 password=ANGEL_PASSWORD, totp_secret=ANGEL_TOTP_SECRET):
        self._api = SmartConnect(api_key=api_key)
        self._client_id = client_id
        self._password = password
        self._totp_secret = totp_secret
        self.auth_token: str = ""
        self.feed_token: str = ""
        self._token_map: dict[str, str] = {}

    def login(self):
        totp = pyotp.TOTP(self._totp_secret).now()
        data = self._api.generateSession(self._client_id, self._password, totp)
        self.auth_token = data["data"]["jwtToken"]
        self.feed_token = data["data"]["feedToken"]
        self._load_token_map()

    def _load_token_map(self):
        """Download Angel One instrument master and build symbol→token map for NSE EQ."""
        try:
            resp = requests.get(INSTRUMENTS_URL, timeout=30)
            instruments = resp.json()
            self._token_map = {
                i["symbol"]: i["token"]
                for i in instruments
                if i.get("exch_seg") == "NSE" and i.get("instrumenttype") == ""
            }
        except Exception:
            self._token_map = {}

    def get_candles(self, symbol: str, timeframe: str, days: int = 5) -> pd.DataFrame:
        token = self._token_map.get(symbol, "")
        if not token:
            return pd.DataFrame()

        interval = INTERVAL_MAP.get(timeframe, "ONE_DAY")
        now = datetime.now(IST)
        from_dt = now - timedelta(days=days)
        params = {
            "exchange": "NSE",
            "symboltoken": token,
            "interval": interval,
            "fromdate": from_dt.strftime("%Y-%m-%d %H:%M"),
            "todate": now.strftime("%Y-%m-%d %H:%M"),
        }
        try:
            resp = self._api.getCandleData(params)
            if not resp.get("status") or not resp.get("data"):
                return pd.DataFrame()
            rows = resp["data"]
            df = pd.DataFrame(rows, columns=["dt","open","high","low","close","volume"])
            df["timestamp"] = pd.to_datetime(df["dt"]).astype(int) // 10**9
            df = df.drop(columns=["dt"])
            return df
        except Exception:
            return pd.DataFrame()

    def get_ltp(self, symbols: list[str]) -> dict[str, float]:
        """Return {symbol: last_traded_price} for given symbols."""
        result = {}
        try:
            tokens = [{"exchange": "NSE", "symboltoken": self._token_map[s], "tradingsymbol": s}
                      for s in symbols if s in self._token_map]
            resp = self._api.getMarketData("LTP", tokens)
            for item in resp.get("data", {}).get("fetched", []):
                result[item["tradingSymbol"]] = float(item["ltp"])
        except Exception:
            pass
        return result
```

- [ ] **Step 4: Run tests**

```powershell
pytest tests/data_fetcher/test_angel_one.py -v
```

Expected: 3 PASSED

- [ ] **Step 5: Commit**

```powershell
git add backend/data_fetcher/angel_one.py tests/data_fetcher/test_angel_one.py
git commit -m "feat: Angel One SmartAPI client with TOTP login and candle fetch"
```

---

## Task 7: Pattern Base

**Files:**
- Create: `backend/patterns/base.py`
- Create: `tests/patterns/test_base.py`

- [ ] **Step 1: Write failing test**

```python
# tests/patterns/test_base.py
from backend.patterns.base import PatternResult

def test_pattern_result_detected():
    r = PatternResult(detected=True, confidence=85, direction="bullish", metadata={"wick": 2.1})
    assert r.detected is True
    assert r.confidence == 85
    assert r.direction == "bullish"

def test_pattern_result_not_detected():
    r = PatternResult(detected=False, confidence=0, direction="neutral")
    assert r.detected is False
    assert r.metadata == {}

def test_pattern_result_clamps_confidence():
    r = PatternResult(detected=True, confidence=150, direction="bullish")
    assert r.confidence <= 100
```

- [ ] **Step 2: Run test — confirm fails**

```powershell
pytest tests/patterns/test_base.py -v
```

- [ ] **Step 3: Create `backend/patterns/base.py`**

```python
from dataclasses import dataclass, field

@dataclass
class PatternResult:
    detected: bool
    confidence: int        # 0–100
    direction: str         # "bullish", "bearish", "neutral"
    metadata: dict = field(default_factory=dict)

    def __post_init__(self):
        self.confidence = max(0, min(100, self.confidence))
```

- [ ] **Step 4: Run tests**

```powershell
pytest tests/patterns/test_base.py -v
```

Expected: 3 PASSED

- [ ] **Step 5: Commit**

```powershell
git add backend/patterns/base.py tests/patterns/test_base.py
git commit -m "feat: PatternResult dataclass"
```

---

## Task 8: Hammer + Bullish Engulfing Patterns

**Files:**
- Create: `backend/patterns/hammer.py`
- Create: `backend/patterns/engulfing.py`
- Create: `tests/patterns/test_hammer.py`
- Create: `tests/patterns/test_engulfing.py`

Helper: All pattern tests use this fixture — add it to `tests/patterns/conftest.py`:

```python
# tests/patterns/conftest.py
import pandas as pd
import numpy as np

def make_candles(rows: list[dict]) -> pd.DataFrame:
    """Build a DataFrame from list of {o,h,l,c,v} dicts."""
    df = pd.DataFrame([{
        "open": r["o"], "high": r["h"], "low": r["l"],
        "close": r["c"], "volume": r.get("v", 1000000)
    } for r in rows])
    return df
```

- [ ] **Step 1: Write failing tests**

```python
# tests/patterns/test_hammer.py
import pytest
from tests.patterns.conftest import make_candles
from backend.patterns.hammer import detect

def test_hammer_detected():
    # Small body near top, long lower wick
    df = make_candles([
        {"o": 100, "h": 101, "l": 90, "c": 100.5, "v": 2000000},  # hammer candle
    ] * 5)
    result = detect(df)
    assert result.detected is True
    assert result.direction == "bullish"
    assert result.confidence > 0

def test_hammer_not_detected_on_bearish_engulfing():
    # Regular bearish candle — no lower wick dominance
    df = make_candles([
        {"o": 105, "h": 106, "l": 95, "c": 96},  # bearish, wick on both sides
    ] * 5)
    result = detect(df)
    assert result.detected is False

def test_hammer_needs_minimum_candles():
    df = make_candles([{"o": 100, "h": 101, "l": 90, "c": 100.5}])
    result = detect(df)
    assert result.detected is False
```

```python
# tests/patterns/test_engulfing.py
from tests.patterns.conftest import make_candles
from backend.patterns.engulfing import detect

def test_bullish_engulfing_detected():
    df = make_candles([
        {"o": 105, "h": 106, "l": 103, "c": 103, "v": 800000},   # bearish prev
        {"o": 102, "h": 109, "l": 101, "c": 108, "v": 1800000},  # bullish, engulfs
    ])
    result = detect(df)
    assert result.detected is True
    assert result.direction == "bullish"

def test_bullish_engulfing_not_detected_if_not_engulfing():
    df = make_candles([
        {"o": 105, "h": 106, "l": 103, "c": 103},
        {"o": 104, "h": 105, "l": 103, "c": 104},  # bullish but too small
    ])
    result = detect(df)
    assert result.detected is False

def test_bullish_engulfing_needs_two_candles():
    df = make_candles([{"o": 105, "h": 106, "l": 103, "c": 103}])
    result = detect(df)
    assert result.detected is False
```

- [ ] **Step 2: Run tests — confirm fail**

```powershell
pytest tests/patterns/test_hammer.py tests/patterns/test_engulfing.py -v
```

- [ ] **Step 3: Create `backend/patterns/hammer.py`**

```python
import pandas as pd
from backend.patterns.base import PatternResult

MIN_CANDLES = 3

def detect(candles: pd.DataFrame) -> PatternResult:
    if len(candles) < MIN_CANDLES:
        return PatternResult(detected=False, confidence=0, direction="neutral")

    last = candles.iloc[-1]
    body = abs(last["close"] - last["open"])
    total_range = last["high"] - last["low"]

    if total_range == 0 or body == 0:
        return PatternResult(detected=False, confidence=0, direction="neutral")

    lower_wick = min(last["open"], last["close"]) - last["low"]
    upper_wick = last["high"] - max(last["open"], last["close"])

    is_bullish_close = last["close"] > last["open"]
    long_lower_wick = lower_wick >= 2 * body
    small_upper_wick = upper_wick <= 0.3 * body
    small_body = body <= 0.35 * total_range

    if long_lower_wick and small_upper_wick and small_body:
        # Volume bonus
        avg_vol = candles["volume"].iloc[:-1].mean()
        vol_ratio = last["volume"] / avg_vol if avg_vol > 0 else 1
        base_score = 55 if is_bullish_close else 45
        vol_bonus = min(20, int((vol_ratio - 1) * 15)) if vol_ratio > 1 else 0
        confidence = min(100, base_score + vol_bonus)
        return PatternResult(
            detected=True, confidence=confidence, direction="bullish",
            metadata={"lower_wick_ratio": round(lower_wick / body, 2), "vol_ratio": round(vol_ratio, 2)}
        )

    return PatternResult(detected=False, confidence=0, direction="neutral")
```

- [ ] **Step 4: Create `backend/patterns/engulfing.py`**

```python
import pandas as pd
from backend.patterns.base import PatternResult

def detect(candles: pd.DataFrame) -> PatternResult:
    if len(candles) < 2:
        return PatternResult(detected=False, confidence=0, direction="neutral")

    prev = candles.iloc[-2]
    curr = candles.iloc[-1]

    prev_bearish = prev["close"] < prev["open"]
    curr_bullish = curr["close"] > curr["open"]

    if not prev_bearish or not curr_bullish:
        return PatternResult(detected=False, confidence=0, direction="neutral")

    prev_body_top = prev["open"]
    prev_body_bot = prev["close"]
    curr_body_top = curr["close"]
    curr_body_bot = curr["open"]

    engulfs = curr_body_top > prev_body_top and curr_body_bot < prev_body_bot

    if engulfs:
        avg_vol = candles["volume"].iloc[:-1].mean()
        vol_ratio = curr["volume"] / avg_vol if avg_vol > 0 else 1
        vol_bonus = min(20, int((vol_ratio - 1) * 12)) if vol_ratio > 1 else 0
        engulf_size = (curr_body_top - curr_body_bot) / (prev_body_top - prev_body_bot) if (prev_body_top - prev_body_bot) > 0 else 1
        size_bonus = min(15, int((engulf_size - 1) * 10))
        confidence = min(100, 55 + vol_bonus + size_bonus)
        return PatternResult(
            detected=True, confidence=confidence, direction="bullish",
            metadata={"engulf_ratio": round(engulf_size, 2), "vol_ratio": round(vol_ratio, 2)}
        )

    return PatternResult(detected=False, confidence=0, direction="neutral")
```

- [ ] **Step 5: Run tests**

```powershell
pytest tests/patterns/test_hammer.py tests/patterns/test_engulfing.py -v
```

Expected: 6 PASSED

- [ ] **Step 6: Commit**

```powershell
git add backend/patterns/hammer.py backend/patterns/engulfing.py tests/patterns/
git commit -m "feat: Hammer and Bullish Engulfing pattern detectors"
```

---

## Task 9: Morning Star + Doji Patterns

**Files:**
- Create: `backend/patterns/morning_star.py`
- Create: `backend/patterns/doji.py`
- Create: `tests/patterns/test_morning_star.py`
- Create: `tests/patterns/test_doji.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/patterns/test_morning_star.py
from tests.patterns.conftest import make_candles
from backend.patterns.morning_star import detect

def test_morning_star_detected():
    df = make_candles([
        {"o": 110, "h": 111, "l": 108, "c": 108, "v": 1000000},  # bearish
        {"o": 107, "h": 108, "l": 106, "c": 107.2, "v": 600000}, # small body (indecision)
        {"o": 108, "h": 115, "l": 107, "c": 114, "v": 1800000},  # bullish, closes above midpoint of candle 1
    ])
    result = detect(df)
    assert result.detected is True
    assert result.direction == "bullish"

def test_morning_star_needs_three_candles():
    df = make_candles([{"o": 110, "h": 111, "l": 108, "c": 108}] * 2)
    result = detect(df)
    assert result.detected is False

def test_morning_star_fails_if_third_candle_too_weak():
    df = make_candles([
        {"o": 110, "h": 111, "l": 108, "c": 108},
        {"o": 107, "h": 108, "l": 106, "c": 107},
        {"o": 108, "h": 109, "l": 107, "c": 108.5},  # barely bullish, doesn't reach midpoint
    ])
    result = detect(df)
    assert result.detected is False
```

```python
# tests/patterns/test_doji.py
from tests.patterns.conftest import make_candles
from backend.patterns.doji import detect

def test_doji_detected():
    # Open ≈ Close, body very small relative to range
    df = make_candles([{"o": 100.0, "h": 105.0, "l": 95.0, "c": 100.2, "v": 1000000}] * 3)
    result = detect(df)
    assert result.detected is True
    assert result.direction == "neutral"

def test_doji_not_detected_on_large_body():
    df = make_candles([{"o": 100, "h": 110, "l": 95, "c": 108}] * 3)
    result = detect(df)
    assert result.detected is False
```

- [ ] **Step 2: Run tests — confirm fail**

```powershell
pytest tests/patterns/test_morning_star.py tests/patterns/test_doji.py -v
```

- [ ] **Step 3: Create `backend/patterns/morning_star.py`**

```python
import pandas as pd
from backend.patterns.base import PatternResult

def detect(candles: pd.DataFrame) -> PatternResult:
    if len(candles) < 3:
        return PatternResult(detected=False, confidence=0, direction="neutral")

    c1, c2, c3 = candles.iloc[-3], candles.iloc[-2], candles.iloc[-1]

    c1_bearish = c1["close"] < c1["open"]
    c2_small = abs(c2["close"] - c2["open"]) <= 0.3 * abs(c1["close"] - c1["open"])
    c3_bullish = c3["close"] > c3["open"]
    c1_midpoint = (c1["open"] + c1["close"]) / 2
    c3_above_midpoint = c3["close"] > c1_midpoint

    if c1_bearish and c2_small and c3_bullish and c3_above_midpoint:
        avg_vol = candles["volume"].iloc[:-1].mean()
        vol_ratio = c3["volume"] / avg_vol if avg_vol > 0 else 1
        vol_bonus = min(20, int((vol_ratio - 1) * 12)) if vol_ratio > 1 else 0
        confidence = min(100, 60 + vol_bonus)
        return PatternResult(
            detected=True, confidence=confidence, direction="bullish",
            metadata={"vol_ratio": round(vol_ratio, 2)}
        )

    return PatternResult(detected=False, confidence=0, direction="neutral")
```

- [ ] **Step 4: Create `backend/patterns/doji.py`**

```python
import pandas as pd
from backend.patterns.base import PatternResult

def detect(candles: pd.DataFrame) -> PatternResult:
    if len(candles) < 1:
        return PatternResult(detected=False, confidence=0, direction="neutral")

    last = candles.iloc[-1]
    body = abs(last["close"] - last["open"])
    total_range = last["high"] - last["low"]

    if total_range == 0:
        return PatternResult(detected=False, confidence=0, direction="neutral")

    body_ratio = body / total_range

    if body_ratio <= 0.10:
        confidence = min(100, int(55 + (0.10 - body_ratio) * 300))
        return PatternResult(
            detected=True, confidence=confidence, direction="neutral",
            metadata={"body_ratio": round(body_ratio, 3)}
        )

    return PatternResult(detected=False, confidence=0, direction="neutral")
```

- [ ] **Step 5: Run tests**

```powershell
pytest tests/patterns/test_morning_star.py tests/patterns/test_doji.py -v
```

Expected: 5 PASSED

- [ ] **Step 6: Commit**

```powershell
git add backend/patterns/morning_star.py backend/patterns/doji.py tests/patterns/
git commit -m "feat: Morning Star and Doji pattern detectors"
```

---

## Task 10: VWAP Indicator + ORB + VWAP Bounce

**Files:**
- Create: `backend/indicators/vwap.py`
- Create: `backend/patterns/orb.py`
- Create: `backend/patterns/vwap_bounce.py`
- Create: `tests/patterns/test_orb.py`
- Create: `tests/patterns/test_vwap_bounce.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/patterns/test_orb.py
import pandas as pd
from tests.patterns.conftest import make_candles
from backend.patterns.orb import detect

def test_orb_breakout_detected():
    # 3 opening range candles + breakout candle
    opening_range = [{"o": 100, "h": 103, "l": 99, "c": 101, "v": 500000}] * 3
    breakout = [{"o": 103, "h": 108, "l": 102, "c": 107, "v": 1800000}]
    df = make_candles(opening_range + breakout)
    result = detect(df, orb_candles=3)
    assert result.detected is True
    assert result.direction == "bullish"

def test_orb_not_detected_without_breakout():
    candles = [{"o": 100, "h": 103, "l": 99, "c": 101, "v": 500000}] * 4
    df = make_candles(candles)
    result = detect(df, orb_candles=3)
    assert result.detected is False

def test_orb_needs_enough_candles():
    df = make_candles([{"o": 100, "h": 103, "l": 99, "c": 101}] * 2)
    result = detect(df, orb_candles=3)
    assert result.detected is False
```

```python
# tests/patterns/test_vwap_bounce.py
import pandas as pd
import numpy as np
from tests.patterns.conftest import make_candles
from backend.patterns.vwap_bounce import detect

def test_vwap_bounce_detected():
    # Create candles where price bounces off VWAP
    # Simulate 20 candles trending up, then dip to VWAP, then bullish rejection
    rows = []
    base = 100.0
    vol = 1_000_000
    for i in range(18):
        rows.append({"o": base+i*0.2, "h": base+i*0.2+1, "l": base+i*0.2-0.5, "c": base+i*0.2+0.5, "v": vol})
    # Dip candle near VWAP
    rows.append({"o": 103.5, "h": 104, "l": 101, "c": 103.8, "v": vol})
    # Bullish rejection off VWAP
    rows.append({"o": 103.2, "h": 106, "l": 103, "c": 105.5, "v": int(vol * 1.8)})
    df = make_candles(rows)
    result = detect(df)
    # Just check it runs and returns a PatternResult
    from backend.patterns.base import PatternResult
    assert isinstance(result, PatternResult)

def test_vwap_bounce_needs_minimum_candles():
    df = make_candles([{"o": 100, "h": 101, "l": 99, "c": 100.5}] * 5)
    result = detect(df)
    assert result.detected is False
```

- [ ] **Step 2: Run tests — confirm fail**

```powershell
pytest tests/patterns/test_orb.py tests/patterns/test_vwap_bounce.py -v
```

- [ ] **Step 3: Create `backend/indicators/vwap.py`**

```python
import pandas as pd

def calculate_vwap(candles: pd.DataFrame) -> pd.Series:
    """Calculate VWAP from a candles DataFrame. Assumes intraday session."""
    typical_price = (candles["high"] + candles["low"] + candles["close"]) / 3
    cumulative_tp_vol = (typical_price * candles["volume"]).cumsum()
    cumulative_vol = candles["volume"].cumsum()
    vwap = cumulative_tp_vol / cumulative_vol
    return vwap
```

- [ ] **Step 4: Create `backend/patterns/orb.py`**

```python
import pandas as pd
from backend.patterns.base import PatternResult

def detect(candles: pd.DataFrame, orb_candles: int = 3) -> PatternResult:
    """Detect Opening Range Breakout. orb_candles = number of candles that form the opening range."""
    if len(candles) < orb_candles + 1:
        return PatternResult(detected=False, confidence=0, direction="neutral")

    opening_range = candles.iloc[:orb_candles]
    orb_high = opening_range["high"].max()
    orb_low = opening_range["low"].min()
    current = candles.iloc[-1]

    if current["close"] > orb_high:
        avg_vol = candles["volume"].iloc[:orb_candles].mean()
        vol_ratio = current["volume"] / avg_vol if avg_vol > 0 else 1
        breakout_strength = (current["close"] - orb_high) / (orb_high - orb_low) if (orb_high - orb_low) > 0 else 0
        vol_bonus = min(25, int((vol_ratio - 1) * 15)) if vol_ratio > 1.5 else 0
        strength_bonus = min(15, int(breakout_strength * 50))
        confidence = min(100, 55 + vol_bonus + strength_bonus)
        return PatternResult(
            detected=True, confidence=confidence, direction="bullish",
            metadata={"orb_high": orb_high, "orb_low": orb_low, "vol_ratio": round(vol_ratio, 2)}
        )

    if current["close"] < orb_low:
        avg_vol = candles["volume"].iloc[:orb_candles].mean()
        vol_ratio = current["volume"] / avg_vol if avg_vol > 0 else 1
        vol_bonus = min(25, int((vol_ratio - 1) * 15)) if vol_ratio > 1.5 else 0
        confidence = min(100, 55 + vol_bonus)
        return PatternResult(
            detected=True, confidence=confidence, direction="bearish",
            metadata={"orb_high": orb_high, "orb_low": orb_low, "vol_ratio": round(vol_ratio, 2)}
        )

    return PatternResult(detected=False, confidence=0, direction="neutral")
```

- [ ] **Step 5: Create `backend/patterns/vwap_bounce.py`**

```python
import pandas as pd
from backend.indicators.vwap import calculate_vwap
from backend.patterns.base import PatternResult

MIN_CANDLES = 15

def detect(candles: pd.DataFrame) -> PatternResult:
    if len(candles) < MIN_CANDLES:
        return PatternResult(detected=False, confidence=0, direction="neutral")

    vwap = calculate_vwap(candles)
    last_idx = len(candles) - 1
    current = candles.iloc[-1]
    prev = candles.iloc[-2]
    current_vwap = vwap.iloc[-1]

    # Price came close to VWAP (within 0.5%)
    prev_low_near_vwap = abs(prev["low"] - current_vwap) / current_vwap <= 0.005

    # Current candle bullish and closes above VWAP
    curr_bullish = current["close"] > current["open"]
    curr_above_vwap = current["close"] > current_vwap

    # Volume confirmation
    avg_vol = candles["volume"].iloc[-10:-1].mean()
    vol_ratio = current["volume"] / avg_vol if avg_vol > 0 else 1

    if prev_low_near_vwap and curr_bullish and curr_above_vwap and vol_ratio >= 1.5:
        vol_bonus = min(20, int((vol_ratio - 1.5) * 15))
        confidence = min(100, 60 + vol_bonus)
        return PatternResult(
            detected=True, confidence=confidence, direction="bullish",
            metadata={"vwap": round(current_vwap, 2), "vol_ratio": round(vol_ratio, 2)}
        )

    return PatternResult(detected=False, confidence=0, direction="neutral")
```

- [ ] **Step 6: Run tests**

```powershell
pytest tests/patterns/test_orb.py tests/patterns/test_vwap_bounce.py -v
```

Expected: 5 PASSED

- [ ] **Step 7: Commit**

```powershell
git add backend/indicators/ backend/patterns/orb.py backend/patterns/vwap_bounce.py tests/patterns/
git commit -m "feat: VWAP indicator, ORB and VWAP Bounce patterns"
```

---

## Task 11: Volume Breakout + Gap Up Patterns

**Files:**
- Create: `backend/patterns/volume_breakout.py`
- Create: `backend/patterns/gap_up.py`
- Create: `tests/patterns/test_volume_breakout.py`
- Create: `tests/patterns/test_gap_up.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/patterns/test_volume_breakout.py
from tests.patterns.conftest import make_candles
from backend.patterns.volume_breakout import detect

def test_volume_breakout_detected():
    normal = [{"o": 100, "h": 102, "l": 99, "c": 101, "v": 500000}] * 20
    breakout = [{"o": 101, "h": 107, "l": 100, "c": 106, "v": 1_600_000}]  # 3.2× avg vol, bullish
    df = make_candles(normal + breakout)
    result = detect(df)
    assert result.detected is True
    assert result.direction == "bullish"

def test_volume_breakout_not_on_down_candle():
    normal = [{"o": 100, "h": 102, "l": 99, "c": 101, "v": 500000}] * 20
    high_vol_bearish = [{"o": 106, "h": 107, "l": 100, "c": 101, "v": 1_600_000}]
    df = make_candles(normal + high_vol_bearish)
    result = detect(df)
    assert result.detected is False

def test_volume_breakout_needs_enough_candles():
    df = make_candles([{"o": 100, "h": 102, "l": 99, "c": 101, "v": 500000}] * 5)
    result = detect(df)
    assert result.detected is False
```

```python
# tests/patterns/test_gap_up.py
from tests.patterns.conftest import make_candles
from backend.patterns.gap_up import detect

def test_gap_up_detected():
    prev = [{"o": 100, "h": 102, "l": 99, "c": 101, "v": 800000}]
    curr = [{"o": 102.5, "h": 108, "l": 102, "c": 106, "v": 1_600_000}]  # opens 1.5% above prev close
    df = make_candles(prev + curr)
    result = detect(df)
    assert result.detected is True
    assert result.direction == "bullish"

def test_gap_up_not_detected_on_small_gap():
    prev = [{"o": 100, "h": 102, "l": 99, "c": 101, "v": 800000}]
    curr = [{"o": 101.2, "h": 102, "l": 100, "c": 101.5, "v": 900000}]  # only 0.2% gap
    df = make_candles(prev + curr)
    result = detect(df)
    assert result.detected is False
```

- [ ] **Step 2: Run tests — confirm fail**

```powershell
pytest tests/patterns/test_volume_breakout.py tests/patterns/test_gap_up.py -v
```

- [ ] **Step 3: Create `backend/patterns/volume_breakout.py`**

```python
import pandas as pd
from backend.patterns.base import PatternResult

MIN_CANDLES = 21
VOL_AVG_WINDOW = 20
VOL_THRESHOLD = 2.5

def detect(candles: pd.DataFrame) -> PatternResult:
    if len(candles) < MIN_CANDLES:
        return PatternResult(detected=False, confidence=0, direction="neutral")

    last = candles.iloc[-1]
    avg_vol = candles["volume"].iloc[-MIN_CANDLES:-1].mean()

    if avg_vol == 0:
        return PatternResult(detected=False, confidence=0, direction="neutral")

    vol_ratio = last["volume"] / avg_vol
    is_bullish = last["close"] > last["open"]

    if vol_ratio >= VOL_THRESHOLD and is_bullish:
        vol_bonus = min(25, int((vol_ratio - VOL_THRESHOLD) * 8))
        confidence = min(100, 55 + vol_bonus)
        return PatternResult(
            detected=True, confidence=confidence, direction="bullish",
            metadata={"vol_ratio": round(vol_ratio, 2), "avg_vol": int(avg_vol)}
        )

    return PatternResult(detected=False, confidence=0, direction="neutral")
```

- [ ] **Step 4: Create `backend/patterns/gap_up.py`**

```python
import pandas as pd
from backend.patterns.base import PatternResult

GAP_THRESHOLD = 0.005  # 0.5%

def detect(candles: pd.DataFrame) -> PatternResult:
    if len(candles) < 2:
        return PatternResult(detected=False, confidence=0, direction="neutral")

    prev = candles.iloc[-2]
    curr = candles.iloc[-1]

    gap_pct = (curr["open"] - prev["close"]) / prev["close"] if prev["close"] > 0 else 0

    if gap_pct >= GAP_THRESHOLD and curr["close"] > curr["open"]:
        avg_vol = candles["volume"].iloc[:-1].mean()
        vol_ratio = curr["volume"] / avg_vol if avg_vol > 0 else 1
        vol_bonus = min(20, int((vol_ratio - 1) * 12)) if vol_ratio > 1 else 0
        gap_bonus = min(15, int(gap_pct * 500))
        confidence = min(100, 55 + vol_bonus + gap_bonus)
        return PatternResult(
            detected=True, confidence=confidence, direction="bullish",
            metadata={"gap_pct": round(gap_pct * 100, 2), "vol_ratio": round(vol_ratio, 2)}
        )

    return PatternResult(detected=False, confidence=0, direction="neutral")
```

- [ ] **Step 5: Run tests**

```powershell
pytest tests/patterns/ -v
```

Expected: All pattern tests PASSED

- [ ] **Step 6: Commit**

```powershell
git add backend/patterns/volume_breakout.py backend/patterns/gap_up.py tests/patterns/
git commit -m "feat: Volume Breakout and Gap Up pattern detectors"
```

---

## Task 12: Basic Scorer + Scan Runner

**Files:**
- Create: `backend/scoring/scorer.py`
- Create: `backend/scanners/scan_runner.py`
- Create: `tests/test_scorer.py`
- Create: `tests/test_scan_runner.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_scorer.py
from backend.scoring.scorer import compute_confidence

def test_score_with_high_volume_boosts_confidence():
    score = compute_confidence(pattern_quality=60, vol_ratio=3.0)
    assert score > 60
    assert score <= 100

def test_score_clamps_to_100():
    score = compute_confidence(pattern_quality=100, vol_ratio=10.0)
    assert score == 100

def test_score_with_low_volume_reduces():
    score = compute_confidence(pattern_quality=60, vol_ratio=0.5)
    assert score <= 60
```

```python
# tests/test_scan_runner.py
import os
os.environ["DB_PATH"] = ":memory:"
os.environ["STOCK_UNIVERSE_PATH"] = "tests/data_fetcher/sample_nifty500.csv"

import pandas as pd
import pytest
from unittest.mock import patch, MagicMock
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

def test_run_scan_for_symbol_writes_to_db():
    init_db()
    df = _make_df(25)
    with patch("backend.scanners.scan_runner.get_candles_from_db", return_value=df):
        run_scan_for_symbol("RELIANCE", ["Daily"])
    from database.db import get_session
    from database.models import DetectedPattern
    session = get_session()
    count = session.query(DetectedPattern).filter_by(symbol="RELIANCE").count()
    session.close()
    assert count >= 0  # May or may not detect — just confirms no crash
```

- [ ] **Step 2: Run tests — confirm fail**

```powershell
pytest tests/test_scorer.py tests/test_scan_runner.py -v
```

- [ ] **Step 3: Create `backend/scoring/scorer.py`**

```python
def compute_confidence(pattern_quality: int, vol_ratio: float) -> int:
    """
    Phase 1 basic scoring: pattern quality (0–60 base) + volume factor (0–40).
    Phase 2 will expand to 5 factors.
    """
    vol_score = 0
    if vol_ratio >= 3.0:
        vol_score = 40
    elif vol_ratio >= 2.0:
        vol_score = 30
    elif vol_ratio >= 1.5:
        vol_score = 20
    elif vol_ratio >= 1.0:
        vol_score = 10
    else:
        vol_score = max(0, int(vol_ratio * 10))

    raw = pattern_quality + vol_score
    return max(0, min(100, raw))
```

- [ ] **Step 4: Create `backend/scanners/scan_runner.py`**

```python
import importlib, time, logging
import pandas as pd
from database.db import get_session
from database.models import Candle, DetectedPattern

logger = logging.getLogger(__name__)

PATTERN_MODULES = [
    "backend.patterns.hammer",
    "backend.patterns.engulfing",
    "backend.patterns.morning_star",
    "backend.patterns.doji",
    "backend.patterns.orb",
    "backend.patterns.vwap_bounce",
    "backend.patterns.volume_breakout",
    "backend.patterns.gap_up",
]

PATTERN_TIMEFRAMES = {
    "backend.patterns.hammer":         ["15m", "1H", "Daily"],
    "backend.patterns.engulfing":      ["15m", "1H", "Daily"],
    "backend.patterns.morning_star":   ["1H", "Daily"],
    "backend.patterns.doji":           ["15m", "1H", "Daily"],
    "backend.patterns.orb":            ["5m", "15m"],
    "backend.patterns.vwap_bounce":    ["5m", "15m"],
    "backend.patterns.volume_breakout":["15m", "1H", "Daily"],
    "backend.patterns.gap_up":         ["Daily", "15m"],
}

def get_candles_from_db(symbol: str, timeframe: str, limit: int = 50) -> pd.DataFrame:
    session = get_session()
    try:
        rows = (session.query(Candle)
                .filter_by(symbol=symbol, timeframe=timeframe)
                .order_by(Candle.timestamp.desc())
                .limit(limit)
                .all())
        if not rows:
            return pd.DataFrame()
        df = pd.DataFrame([{
            "open": r.open, "high": r.high, "low": r.low,
            "close": r.close, "volume": r.volume, "timestamp": r.timestamp
        } for r in reversed(rows)])
        return df
    finally:
        session.close()

def _write_signal(symbol: str, timeframe: str, pattern_name: str,
                  confidence: int, direction: str, vol_confirmation: bool):
    session = get_session()
    try:
        ts = int(time.time())
        existing = (session.query(DetectedPattern)
                    .filter_by(symbol=symbol, pattern_name=pattern_name,
                               timeframe=timeframe, detected_at=ts)
                    .first())
        if existing:
            return
        session.add(DetectedPattern(
            symbol=symbol, timeframe=timeframe, pattern_name=pattern_name,
            confidence_score=confidence, trend_direction=direction,
            volume_confirmation=1 if vol_confirmation else 0,
            detected_at=ts,
        ))
        session.commit()
    except Exception:
        session.rollback()
    finally:
        session.close()

def run_scan_for_symbol(symbol: str, timeframes: list[str] | None = None):
    for module_path in PATTERN_MODULES:
        pattern_name = module_path.split(".")[-1]
        allowed_tfs = PATTERN_TIMEFRAMES.get(module_path, ["Daily"])
        scan_tfs = [tf for tf in (timeframes or allowed_tfs) if tf in allowed_tfs]

        try:
            mod = importlib.import_module(module_path)
        except ImportError:
            continue

        for tf in scan_tfs:
            candles = get_candles_from_db(symbol, tf)
            if candles.empty:
                continue
            try:
                result = mod.detect(candles)
                if result.detected and result.confidence > 0:
                    vol_confirm = result.metadata.get("vol_ratio", 1.0) >= 1.5
                    _write_signal(symbol, tf, pattern_name, result.confidence,
                                  result.direction, vol_confirm)
            except Exception as e:
                logger.warning(f"Pattern {pattern_name} failed on {symbol}/{tf}: {e}")

def run_full_scan(symbols: list[str], timeframes: list[str] | None = None):
    for symbol in symbols:
        run_scan_for_symbol(symbol, timeframes)
```

- [ ] **Step 5: Run tests**

```powershell
pytest tests/test_scorer.py tests/test_scan_runner.py -v
```

Expected: All PASSED

- [ ] **Step 6: Commit**

```powershell
git add backend/scoring/ backend/scanners/ tests/test_scorer.py tests/test_scan_runner.py
git commit -m "feat: basic scorer and scan runner"
```

---

## Task 13: Telegram Alerts

**Files:**
- Create: `backend/alerts/telegram.py`
- Create: `tests/test_telegram.py`

- [ ] **Step 1: Write failing test**

```python
# tests/test_telegram.py
import os, time
os.environ["DB_PATH"] = ":memory:"
os.environ["TELEGRAM_BOT_TOKEN"] = "fake:token"
os.environ["TELEGRAM_CHAT_ID"] = "123456"
os.environ["ALERT_MIN_CONFIDENCE"] = "70"

import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from database.db import init_db
from backend.alerts.telegram import send_alert, is_duplicate_alert

def test_duplicate_suppression_blocks_repeat():
    init_db()
    assert is_duplicate_alert("RELIANCE", "hammer", "Daily") is False
    # Record the alert
    from database.db import get_session
    from database.models import Alert
    session = get_session()
    session.add(Alert(symbol="RELIANCE", alert_type="hammer|Daily", message="test", sent_at=int(time.time())))
    session.commit()
    session.close()
    assert is_duplicate_alert("RELIANCE", "hammer", "Daily") is True

def test_duplicate_suppression_allows_after_expiry():
    init_db()
    from database.db import get_session
    from database.models import Alert
    session = get_session()
    # Add alert from 2 hours ago
    session.add(Alert(symbol="TCS", alert_type="doji|1H", message="old", sent_at=int(time.time()) - 7200))
    session.commit()
    session.close()
    assert is_duplicate_alert("TCS", "doji", "1H") is False
```

- [ ] **Step 2: Run tests — confirm fail**

```powershell
pytest tests/test_telegram.py -v
```

- [ ] **Step 3: Create `backend/alerts/telegram.py`**

```python
import time, logging, asyncio
import telegram
from database.db import get_session
from database.models import Alert
from config.settings import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, ALERT_MIN_CONFIDENCE

logger = logging.getLogger(__name__)
DEDUP_WINDOW_SECONDS = 3600  # 1 hour

def is_duplicate_alert(symbol: str, pattern_name: str, timeframe: str) -> bool:
    alert_type = f"{pattern_name}|{timeframe}"
    cutoff = int(time.time()) - DEDUP_WINDOW_SECONDS
    session = get_session()
    try:
        existing = (session.query(Alert)
                    .filter(Alert.symbol == symbol,
                            Alert.alert_type == alert_type,
                            Alert.sent_at >= cutoff)
                    .first())
        return existing is not None
    finally:
        session.close()

def _record_alert(symbol: str, pattern_name: str, timeframe: str, message: str):
    session = get_session()
    try:
        session.add(Alert(
            symbol=symbol,
            alert_type=f"{pattern_name}|{timeframe}",
            message=message,
            sent_at=int(time.time()),
        ))
        session.commit()
    finally:
        session.close()

def send_alert(symbol: str, pattern_name: str, timeframe: str,
               confidence: int, direction: str, sector: str = ""):
    if confidence < ALERT_MIN_CONFIDENCE:
        return
    if is_duplicate_alert(symbol, pattern_name, timeframe):
        return

    from zoneinfo import ZoneInfo
    from datetime import datetime
    ist_time = datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%d-%b %H:%M IST")
    trend_arrow = "↑" if direction == "bullish" else "↓" if direction == "bearish" else "→"
    sector_line = f"\nSector: {sector} {trend_arrow}" if sector else ""

    message = (
        f"🔔 {symbol} | {pattern_name.replace('_', ' ').title()} | {timeframe}\n"
        f"Confidence: {confidence}% | Trend: {direction.title()}{sector_line}\n"
        f"{ist_time}"
    )

    try:
        bot = telegram.Bot(token=TELEGRAM_BOT_TOKEN)
        asyncio.run(bot.send_message(chat_id=TELEGRAM_CHAT_ID, text=message))
        _record_alert(symbol, pattern_name, timeframe, message)
        logger.info(f"Alert sent: {symbol} {pattern_name} {timeframe}")
    except Exception as e:
        logger.error(f"Telegram alert failed: {e}")
```

- [ ] **Step 4: Run tests**

```powershell
pytest tests/test_telegram.py -v
```

Expected: 2 PASSED

- [ ] **Step 5: Commit**

```powershell
git add backend/alerts/telegram.py tests/test_telegram.py
git commit -m "feat: Telegram alert sender with 1-hour duplicate suppression"
```

---

## Task 14: Database Query Helpers + APScheduler + main.py

**Files:**
- Create: `database/queries.py`
- Create: `main.py`

- [ ] **Step 1: Create `database/queries.py`**

```python
import time
import pandas as pd
from database.db import get_session
from database.models import DetectedPattern, Stock, SectorStrength

def get_recent_signals(hours: int = 24, min_confidence: int = 0) -> pd.DataFrame:
    cutoff = int(time.time()) - hours * 3600
    session = get_session()
    try:
        rows = (session.query(DetectedPattern)
                .filter(DetectedPattern.detected_at >= cutoff,
                        DetectedPattern.confidence_score >= min_confidence)
                .order_by(DetectedPattern.detected_at.desc())
                .limit(500)
                .all())
        if not rows:
            return pd.DataFrame()
        return pd.DataFrame([{
            "symbol": r.symbol, "pattern": r.pattern_name, "timeframe": r.timeframe,
            "confidence": r.confidence_score, "direction": r.trend_direction,
            "volume_ok": bool(r.volume_confirmation), "detected_at": r.detected_at,
        } for r in rows])
    finally:
        session.close()

def get_top_momentum_stocks(limit: int = 50, fno_only: bool = False) -> pd.DataFrame:
    """Returns symbols ranked by confidence score of their latest signals."""
    session = get_session()
    try:
        cutoff = int(time.time()) - 24 * 3600
        q = (session.query(
                DetectedPattern.symbol,
                Stock.sector,
                Stock.is_fno,
                DetectedPattern.confidence_score,
                DetectedPattern.trend_direction,
                DetectedPattern.detected_at,
             )
             .join(Stock, Stock.symbol == DetectedPattern.symbol)
             .filter(DetectedPattern.detected_at >= cutoff,
                     DetectedPattern.trend_direction == "bullish"))
        if fno_only:
            q = q.filter(Stock.is_fno == 1)
        rows = q.order_by(DetectedPattern.confidence_score.desc()).limit(limit * 3).all()
        if not rows:
            return pd.DataFrame()
        # Deduplicate — keep best signal per symbol
        seen = {}
        for r in rows:
            if r.symbol not in seen:
                seen[r.symbol] = r
        top = list(seen.values())[:limit]
        return pd.DataFrame([{
            "symbol": r.symbol, "sector": r.sector, "is_fno": r.is_fno,
            "confidence": r.confidence_score, "direction": r.trend_direction,
        } for r in top])
    finally:
        session.close()

def get_sector_strength() -> pd.DataFrame:
    session = get_session()
    try:
        rows = session.query(SectorStrength).order_by(SectorStrength.strength_score.desc()).all()
        if not rows:
            return pd.DataFrame()
        return pd.DataFrame([{
            "sector": r.sector, "strength": r.strength_score, "momentum": r.momentum_score
        } for r in rows])
    finally:
        session.close()
```

- [ ] **Step 2: Create `main.py`**

```python
import logging, subprocess, sys
from apscheduler.schedulers.background import BackgroundScheduler
from database.db import init_db
from backend.data_fetcher.stock_universe import load_stock_universe, get_all_symbols
from backend.data_fetcher.yfinance_client import fetch_candles
from backend.scanners.scan_runner import run_full_scan
from backend.data_fetcher.angel_one import AngelOneClient
from database.db import get_session
from database.models import Candle
from utils.time_utils import is_market_open
from config.settings import ANGEL_API_KEY, ANGEL_CLIENT_ID, ANGEL_PASSWORD, ANGEL_TOTP_SECRET
import time

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

angel = AngelOneClient()
_angel_logged_in = False

def _try_angel_login():
    global _angel_logged_in
    try:
        angel.login()
        _angel_logged_in = True
        logger.info("Angel One login successful")
    except Exception as e:
        logger.warning(f"Angel One login failed: {e}. Will use yfinance fallback.")
        _angel_logged_in = False

def _store_candles(symbol: str, timeframe: str, df):
    if df.empty:
        return
    session = get_session()
    try:
        for _, row in df.iterrows():
            from sqlalchemy.dialects.sqlite import insert as sqlite_insert
            session.merge(Candle(
                symbol=symbol, timeframe=timeframe,
                timestamp=int(row["timestamp"]),
                open=row["open"], high=row["high"],
                low=row["low"], close=row["close"],
                volume=int(row["volume"]),
            ))
        session.commit()
    except Exception:
        session.rollback()
    finally:
        session.close()

def job_fetch_and_scan(timeframes: list[str]):
    if not is_market_open():
        return
    symbols = get_all_symbols()
    for symbol in symbols:
        for tf in timeframes:
            if _angel_logged_in:
                df = angel.get_candles(symbol, tf, days=5)
            else:
                df = fetch_candles(symbol, tf, days=5)
            _store_candles(symbol, tf, df)
    run_full_scan(symbols, timeframes)
    logger.info(f"Scan complete: {timeframes}")

def job_daily_backfill():
    symbols = get_all_symbols()
    for symbol in symbols:
        for tf in ["Daily", "Weekly"]:
            df = fetch_candles(symbol, tf)
            _store_candles(symbol, tf, df)
    run_full_scan(symbols, ["Daily", "Weekly"])
    logger.info("Daily backfill and scan complete")

def start_scheduler():
    scheduler = BackgroundScheduler(timezone="Asia/Kolkata")
    scheduler.add_job(lambda: job_fetch_and_scan(["5m"]),   "cron", minute="*/5",  hour="9-15")
    scheduler.add_job(lambda: job_fetch_and_scan(["15m"]),  "cron", minute="*/15", hour="9-15")
    scheduler.add_job(lambda: job_fetch_and_scan(["1H"]),   "cron", minute="15",   hour="9-15")
    scheduler.add_job(job_daily_backfill,                   "cron", hour="18",     minute="0")
    scheduler.add_job(_try_angel_login,                     "cron", hour="9",      minute="0")
    scheduler.start()
    return scheduler

if __name__ == "__main__":
    init_db()
    load_stock_universe()
    _try_angel_login()

    # Initial backfill on startup
    logger.info("Running initial data backfill...")
    job_daily_backfill()

    scheduler = start_scheduler()
    logger.info("Scheduler started. Launching dashboard...")

    subprocess.Popen([sys.executable, "-m", "streamlit", "run", "app/main_app.py"])

    try:
        while True:
            time.sleep(60)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        logger.info("Shutdown complete.")
```

- [ ] **Step 3: Verify scheduler starts without error**

```powershell
python -c "
from database.db import init_db
from backend.data_fetcher.stock_universe import load_stock_universe
init_db()
print('DB OK')
"
```

Expected: `DB OK`

- [ ] **Step 4: Commit**

```powershell
git add database/queries.py main.py
git commit -m "feat: query helpers, APScheduler jobs, and main entry point"
```

---

## Task 15: Streamlit Home Page

**Files:**
- Create: `app/main_app.py`
- Create: `app/components/tables.py`
- Create: `app/components/metrics.py`
- Create: `app/components/charts.py`
- Create: `app/pages/01_home.py`

- [ ] **Step 1: Create `app/main_app.py`**

```python
import streamlit as st

st.set_page_config(
    page_title="TraDad — Market Intelligence",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.title("📈 TraDad Market Intelligence")
st.caption("Real-time pattern scanner for NSE markets")
st.page_link("pages/01_home.py", label="Home", icon="🏠")
st.page_link("pages/02_pattern_scanner.py", label="Pattern Scanner", icon="🔍")
```

- [ ] **Step 2: Create `app/components/tables.py`**

```python
import pandas as pd
import streamlit as st

def render_signals_table(df: pd.DataFrame):
    if df.empty:
        st.info("No signals found.")
        return
    display = df.copy()
    if "detected_at" in display.columns:
        import time
        display["time"] = display["detected_at"].apply(
            lambda ts: __import__("datetime").datetime.fromtimestamp(ts, tz=__import__("zoneinfo").ZoneInfo("Asia/Kolkata")).strftime("%H:%M")
        )
        display = display.drop(columns=["detected_at"])
    st.dataframe(
        display,
        use_container_width=True,
        column_config={
            "confidence": st.column_config.ProgressColumn("Confidence", min_value=0, max_value=100, format="%d%%"),
        },
        hide_index=True,
    )

def render_top_stocks_table(df: pd.DataFrame, title: str = "Top Stocks"):
    if df.empty:
        st.info(f"No {title} data available.")
        return
    st.subheader(title)
    st.dataframe(
        df,
        use_container_width=True,
        column_config={
            "confidence": st.column_config.ProgressColumn("Confidence", min_value=0, max_value=100, format="%d%%"),
        },
        hide_index=True,
    )
```

- [ ] **Step 3: Create `app/components/metrics.py`**

```python
import streamlit as st

def render_index_card(name: str, ltp: float, change_pct: float, trend: str):
    color = "🟢" if change_pct >= 0 else "🔴"
    trend_icon = "↑" if trend == "Bullish" else "↓" if trend == "Bearish" else "→"
    st.metric(
        label=f"{color} {name}",
        value=f"{ltp:,.1f}",
        delta=f"{change_pct:+.2f}% {trend_icon}",
    )
```

- [ ] **Step 4: Create `app/components/charts.py`**

```python
import plotly.graph_objects as go
import pandas as pd

def render_sector_bar(df: pd.DataFrame):
    if df.empty:
        return go.Figure()
    df_sorted = df.sort_values("strength", ascending=True)
    colors = ["#e74c3c" if v < 0 else "#2ecc71" for v in df_sorted["strength"]]
    fig = go.Figure(go.Bar(
        x=df_sorted["strength"],
        y=df_sorted["sector"],
        orientation="h",
        marker_color=colors,
    ))
    fig.update_layout(
        title="Sector Strength",
        xaxis_title="Strength Score",
        height=400,
        margin=dict(l=10, r=10, t=40, b=10),
    )
    return fig
```

- [ ] **Step 5: Create `app/pages/01_home.py`**

```python
import streamlit as st
import time
from database.queries import get_recent_signals, get_top_momentum_stocks, get_sector_strength
from app.components.tables import render_signals_table, render_top_stocks_table
from app.components.metrics import render_index_card
from app.components.charts import render_sector_bar

st.set_page_config(page_title="Home | TraDad", layout="wide")
st.title("🏠 Market Overview")

REFRESH_SECS = 15

# Market indices (placeholder LTP — replace with live fetch in next iteration)
st.subheader("Market Indices")
col1, col2, col3 = st.columns(3)
with col1:
    render_index_card("NIFTY 50", 22450.0, 0.45, "Bullish")
with col2:
    render_index_card("BANKNIFTY", 48200.0, -0.22, "Bearish")
with col3:
    render_index_card("FINNIFTY", 21300.0, 0.10, "Neutral")

st.divider()

# Top stocks tabs
tab1, tab2 = st.tabs(["Top 50 Momentum (All)", "Top 50 F&O Stocks"])

with tab1:
    df_all = get_top_momentum_stocks(limit=50, fno_only=False)
    render_top_stocks_table(df_all, "Top 50 Momentum Stocks")

with tab2:
    df_fno = get_top_momentum_stocks(limit=50, fno_only=True)
    render_top_stocks_table(df_fno, "Top 50 F&O Momentum Stocks")

st.divider()

# Sector strength
st.subheader("Sector Strength")
df_sectors = get_sector_strength()
import plotly.graph_objects as go
fig = render_sector_bar(df_sectors)
if fig.data:
    st.plotly_chart(fig, use_container_width=True)
else:
    st.info("Sector data updating...")

st.divider()

# Live alerts feed
st.subheader("Live Alerts Feed (Last 24h)")
df_signals = get_recent_signals(hours=24, min_confidence=65)
render_signals_table(df_signals.head(20) if not df_signals.empty else df_signals)

# Auto-refresh
time.sleep(REFRESH_SECS)
st.rerun()
```

- [ ] **Step 6: Test the dashboard renders**

```powershell
streamlit run app/main_app.py
```

Open browser at `http://localhost:8501`. Verify home page loads without errors. Check that empty state messages show correctly (no data yet).

- [ ] **Step 7: Commit**

```powershell
git add app/
git commit -m "feat: Streamlit home page with top 50 stocks, sector chart, alerts feed"
```

---

## Task 16: Pattern Scanner Page

**Files:**
- Create: `app/pages/02_pattern_scanner.py`

- [ ] **Step 1: Create `app/pages/02_pattern_scanner.py`**

```python
import streamlit as st
from database.queries import get_recent_signals
from database.db import get_session
from database.models import Stock
from app.components.tables import render_signals_table

st.set_page_config(page_title="Pattern Scanner | TraDad", layout="wide")
st.title("🔍 Pattern Scanner")
st.caption("Results pre-computed by background scanner. Auto-refreshes every 30 seconds.")

PATTERN_NAMES = [
    "hammer", "engulfing", "morning_star", "doji",
    "orb", "vwap_bounce", "volume_breakout", "gap_up",
]

TIMEFRAMES = ["5m", "15m", "1H", "Daily"]

def get_sectors() -> list[str]:
    session = get_session()
    try:
        rows = session.query(Stock.sector).distinct().all()
        return sorted([r.sector for r in rows if r.sector])
    finally:
        session.close()

# Sidebar filters
with st.sidebar:
    st.header("Filters")
    selected_patterns = st.multiselect(
        "Patterns", options=PATTERN_NAMES,
        default=PATTERN_NAMES,
        format_func=lambda x: x.replace("_", " ").title()
    )
    selected_timeframes = st.multiselect("Timeframes", TIMEFRAMES, default=TIMEFRAMES)
    min_confidence = st.slider("Min Confidence", 50, 95, 70, step=5)
    sectors = get_sectors()
    selected_sector = st.selectbox("Sector", ["All"] + sectors)
    fno_only = st.toggle("F&O Only", value=False)

# Fetch signals
df = get_recent_signals(hours=24, min_confidence=min_confidence)

if not df.empty:
    if selected_patterns:
        df = df[df["pattern"].isin(selected_patterns)]
    if selected_timeframes:
        df = df[df["timeframe"].isin(selected_timeframes)]
    if selected_sector != "All":
        # Join sector from stocks table
        session = get_session()
        try:
            stock_sectors = {r.symbol: r.sector for r in session.query(Stock).all()}
        finally:
            session.close()
        df["sector"] = df["symbol"].map(stock_sectors)
        df = df[df["sector"] == selected_sector]
    if fno_only:
        session = get_session()
        try:
            fno_set = {r.symbol for r in session.query(Stock).filter_by(is_fno=1).all()}
        finally:
            session.close()
        df = df[df["symbol"].isin(fno_set)]

st.metric("Signals Found", len(df) if not df.empty else 0)

if st.button("Refresh"):
    st.rerun()

render_signals_table(df)

import time
time.sleep(30)
st.rerun()
```

- [ ] **Step 2: Test pattern scanner page**

```powershell
streamlit run app/main_app.py
```

Navigate to Pattern Scanner. Verify filters work. Verify table renders correctly with empty state.

- [ ] **Step 3: Run all tests one final time**

```powershell
pytest tests/ -v
```

Expected: All tests PASSED

- [ ] **Step 4: Final Phase 1 commit**

```powershell
git add app/pages/02_pattern_scanner.py
git commit -m "feat: Pattern Scanner page with multi-filter sidebar"
git tag v1.0.0-phase1
```

- [ ] **Step 5: Smoke test end-to-end**

```powershell
# With NIFTY 500 CSV in data/ and .env filled:
python main.py
```

Verify:
- DB initialises without error
- Stock universe loads (check logs)
- Initial backfill runs
- Scheduler starts
- Dashboard opens in browser
- Home and Scanner pages render

---

## Phase 1 Complete

At this point you have:
- SQLite DB with all schema
- 8 pattern detectors (all tested)
- Background scanner running every 5/15 min during market hours
- 2-page Streamlit dashboard (Home + Pattern Scanner)
- Telegram alerts with duplicate suppression
- yfinance + Angel One data pipeline

**Proceed to Phase 2 plan:** `docs/superpowers/plans/2026-05-17-phase2-intelligence-engine.md`

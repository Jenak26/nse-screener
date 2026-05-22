# NSE Stock Screener — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A live NSE stock screener at a public URL — daily pipeline fetches fundamentals for NIFTY 500, FastAPI serves filtered/sorted data, React UI lets users filter by P/E, ROE, D/E, Revenue Growth, Promoter Holding, Sector.

**Architecture:** APScheduler inside FastAPI fetches fundamentals daily at 6:30 AM IST via yfinance + NSE public shareholding CSVs, stores in SQLite. FastAPI REST API serves pre-computed data with SQL-level filtering. React (Vite + TypeScript) on Vercel consumes the API.

**Tech Stack:** Python 3.12, FastAPI 0.111, SQLAlchemy 2, APScheduler 3, yfinance, React 18, Vite 5, TypeScript, TanStack Table v8, TanStack Query v5, Tailwind CSS 3

---

## File Map

| File | Responsibility |
|---|---|
| `backend/config/settings.py` | Env var config via pydantic-settings |
| `backend/database/models.py` | SQLAlchemy `Stock` ORM model |
| `backend/database/db.py` | Engine, session factory, `init_db()` |
| `backend/database/queries.py` | SQL filter/sort/paginate query builder |
| `backend/pipeline/fetcher.py` | yfinance bulk fundamental fetch |
| `backend/pipeline/nse_holdings.py` | NSE quarterly shareholding CSV parser |
| `backend/pipeline/scheduler.py` | APScheduler daily job + pipeline runner |
| `backend/api/schemas.py` | Pydantic response models |
| `backend/api/main.py` | FastAPI app, CORS, lifespan, route registration |
| `backend/api/routes/stocks.py` | `/api/stocks` and `/api/stocks/{symbol}` |
| `backend/api/routes/sectors.py` | `/api/sectors` and `/api/meta` |
| `tests/conftest.py` | Shared in-memory SQLite fixtures |
| `tests/test_queries.py` | Query builder tests |
| `tests/test_pipeline.py` | Fetcher + holdings parser tests (mocked) |
| `tests/test_api.py` | API endpoint integration tests |
| `frontend/src/types/stock.ts` | TypeScript interfaces |
| `frontend/src/lib/api.ts` | API client functions |
| `frontend/src/hooks/useStocks.ts` | TanStack Query hooks |
| `frontend/src/components/FilterPanel.tsx` | Left sidebar filter controls |
| `frontend/src/components/StockTable.tsx` | Sortable paginated data table |
| `frontend/src/components/StockDetailModal.tsx` | Stock detail overlay |
| `frontend/src/App.tsx` | Root layout, filter state, composition |

---

### Task 1: Project cleanup and structure

**Files:**
- Delete: `app/`, `backend/patterns/`, `backend/scanners/`, `backend/scoring/`, `backend/sectors/`, `backend/alerts/`, `backend/rankings/`, `backend/backtesting/`, `backend/indicators/`, `backend/data_fetcher/`, `database/`, `config/`
- Delete: `docs/superpowers/plans/2026-05-17-*.md`
- Create dirs: `backend/config/`, `backend/database/`, `backend/pipeline/`, `backend/api/`, `backend/api/routes/`
- Modify: `requirements.txt`
- Create: `pytest.ini`

- [ ] **Step 1: Remove old directories**

```powershell
Remove-Item -Recurse -Force app, database, config
Remove-Item -Recurse -Force backend\patterns, backend\scanners, backend\scoring
Remove-Item -Recurse -Force backend\sectors, backend\alerts, backend\rankings
Remove-Item -Recurse -Force backend\backtesting, backend\indicators, backend\data_fetcher
Remove-Item -Force docs\superpowers\plans\2026-05-17-*.md
```

- [ ] **Step 2: Create new directory structure**

```powershell
New-Item -ItemType Directory -Force backend\config
New-Item -ItemType Directory -Force backend\database
New-Item -ItemType Directory -Force backend\pipeline
New-Item -ItemType Directory -Force backend\api\routes
```

- [ ] **Step 3: Create `__init__.py` files**

```powershell
"" | Out-File -FilePath backend\config\__init__.py -Encoding utf8
"" | Out-File -FilePath backend\database\__init__.py -Encoding utf8
"" | Out-File -FilePath backend\pipeline\__init__.py -Encoding utf8
"" | Out-File -FilePath backend\api\__init__.py -Encoding utf8
"" | Out-File -FilePath backend\api\routes\__init__.py -Encoding utf8
```

- [ ] **Step 4: Write `requirements.txt`**

```
fastapi>=0.111.0
uvicorn[standard]>=0.30.0
sqlalchemy>=2.0.0
apscheduler>=3.10.0
yfinance>=0.2.40
pandas>=2.0.0
python-dotenv>=1.0.0
pydantic>=2.0.0
pydantic-settings>=2.0.0
requests>=2.31.0
pytest>=7.4.0
httpx>=0.27.0
```

- [ ] **Step 5: Write `pytest.ini`**

```ini
[pytest]
testpaths = tests
pythonpath = .
```

- [ ] **Step 6: Install dependencies**

```powershell
pip install -r requirements.txt
```

Expected: all packages install without error.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove old Streamlit/pattern code, scaffold new structure"
```

---

### Task 2: Config and database models

**Files:**
- Create: `backend/config/settings.py`
- Create: `backend/database/models.py`
- Create: `backend/database/db.py`

- [ ] **Step 1: Write `backend/config/settings.py`**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./nse_screener.db"
    stock_universe_path: str = "data/nifty500.csv"
    pipeline_run_hour: int = 6
    pipeline_run_minute: int = 30
    cors_origins: str = "http://localhost:5173"

    class Config:
        env_file = ".env"


settings = Settings()
```

- [ ] **Step 2: Write `backend/database/models.py`**

```python
from sqlalchemy import Column, Text, Float, DateTime
from sqlalchemy.orm import DeclarativeBase
from datetime import datetime


class Base(DeclarativeBase):
    pass


class Stock(Base):
    __tablename__ = "stocks"

    symbol = Column(Text, primary_key=True)
    company_name = Column(Text)
    sector = Column(Text)
    market_cap = Column(Float)
    pe_ratio = Column(Float)
    roe = Column(Float)
    debt_to_equity = Column(Float)
    revenue_growth_yoy = Column(Float)
    promoter_holding = Column(Float)
    current_ratio = Column(Float)
    price = Column(Float)
    fifty_two_week_high = Column(Float)
    updated_at = Column(DateTime, default=datetime.utcnow)
```

- [ ] **Step 3: Write `backend/database/db.py`**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database.models import Base
from backend.config.settings import settings

_connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, echo=False, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def init_db():
    Base.metadata.create_all(engine)


def get_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
```

- [ ] **Step 4: Verify imports resolve**

```powershell
python -c "from backend.database.models import Stock; from backend.database.db import init_db; print('OK')"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/config/ backend/database/
git commit -m "feat: add config settings and Stock database model"
```

---

### Task 3: Query builder and tests

**Files:**
- Create: `backend/database/queries.py`
- Create: `tests/conftest.py`
- Create: `tests/test_queries.py`

- [ ] **Step 1: Write failing tests in `tests/test_queries.py`**

```python
import pytest
from backend.database.queries import get_stocks, get_sector_stats, get_last_updated, get_distinct_sectors


def test_get_stocks_no_filters_returns_all(db_session):
    stocks, total = get_stocks(db_session)
    assert total == 3
    assert len(stocks) == 3


def test_get_stocks_sector_filter(db_session):
    stocks, total = get_stocks(db_session, sector="Technology")
    assert total == 1
    assert stocks[0].symbol == "TCS"


def test_get_stocks_pe_max_filter(db_session):
    stocks, total = get_stocks(db_session, pe_max=20.0)
    assert all(s.pe_ratio <= 20.0 for s in stocks)


def test_get_stocks_roe_min_filter(db_session):
    stocks, total = get_stocks(db_session, roe_min=15.0)
    assert all(s.roe >= 15.0 for s in stocks)


def test_get_stocks_sort_by_roe_desc(db_session):
    stocks, _ = get_stocks(db_session, sort_by="roe", sort_dir="desc", page_size=10)
    roes = [s.roe for s in stocks if s.roe is not None]
    assert roes == sorted(roes, reverse=True)


def test_get_stocks_pagination(db_session):
    stocks_p1, total = get_stocks(db_session, page=1, page_size=2)
    stocks_p2, _ = get_stocks(db_session, page=2, page_size=2)
    assert len(stocks_p1) == 2
    assert len(stocks_p2) == 1
    assert total == 3


def test_get_sector_stats(db_session):
    stats = get_sector_stats(db_session)
    sectors = [s["sector"] for s in stats]
    assert "Technology" in sectors


def test_get_last_updated(db_session):
    result = get_last_updated(db_session)
    assert result is not None


def test_get_distinct_sectors(db_session):
    sectors = get_distinct_sectors(db_session)
    assert "Technology" in sectors
    assert "Energy" in sectors
```

- [ ] **Step 2: Write `tests/conftest.py`**

```python
import pytest
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database.models import Base, Stock


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    session.add_all([
        Stock(symbol="RELIANCE", company_name="Reliance Industries", sector="Energy",
              market_cap=1500000.0, pe_ratio=22.5, roe=12.5, debt_to_equity=0.5,
              revenue_growth_yoy=15.0, promoter_holding=50.0, updated_at=datetime.utcnow()),
        Stock(symbol="TCS", company_name="Tata Consultancy Services", sector="Technology",
              market_cap=1200000.0, pe_ratio=28.0, roe=40.0, debt_to_equity=0.0,
              revenue_growth_yoy=10.0, promoter_holding=72.0, updated_at=datetime.utcnow()),
        Stock(symbol="HDFCBANK", company_name="HDFC Bank", sector="Financial Services",
              market_cap=800000.0, pe_ratio=18.0, roe=18.0, debt_to_equity=1.2,
              revenue_growth_yoy=20.0, promoter_holding=26.0, updated_at=datetime.utcnow()),
    ])
    session.commit()
    yield session
    session.close()
```

- [ ] **Step 3: Run tests to confirm they fail**

```powershell
pytest tests/test_queries.py -v
```

Expected: `ImportError` or `ModuleNotFoundError` — `queries` doesn't exist yet.

- [ ] **Step 4: Write `backend/database/queries.py`**

```python
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from typing import Optional
from backend.database.models import Stock

VALID_SORT_COLUMNS = {
    "symbol", "company_name", "sector", "market_cap", "pe_ratio",
    "roe", "debt_to_equity", "revenue_growth_yoy", "promoter_holding",
    "price", "fifty_two_week_high", "current_ratio",
}


def get_stocks(
    session: Session,
    sector: Optional[str] = None,
    pe_min: Optional[float] = None,
    pe_max: Optional[float] = None,
    roe_min: Optional[float] = None,
    debt_max: Optional[float] = None,
    revenue_growth_min: Optional[float] = None,
    promoter_min: Optional[float] = None,
    sort_by: str = "market_cap",
    sort_dir: str = "desc",
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Stock], int]:
    if sort_by not in VALID_SORT_COLUMNS:
        sort_by = "market_cap"

    q = select(Stock)
    if sector:
        q = q.where(Stock.sector == sector)
    if pe_min is not None:
        q = q.where(Stock.pe_ratio >= pe_min)
    if pe_max is not None:
        q = q.where(Stock.pe_ratio <= pe_max)
    if roe_min is not None:
        q = q.where(Stock.roe >= roe_min)
    if debt_max is not None:
        q = q.where(Stock.debt_to_equity <= debt_max)
    if revenue_growth_min is not None:
        q = q.where(Stock.revenue_growth_yoy >= revenue_growth_min)
    if promoter_min is not None:
        q = q.where(Stock.promoter_holding >= promoter_min)

    total = session.scalar(select(func.count()).select_from(q.subquery())) or 0

    sort_col = getattr(Stock, sort_by)
    order = sort_col.desc().nulls_last() if sort_dir == "desc" else sort_col.asc().nulls_last()
    q = q.order_by(order).offset((page - 1) * page_size).limit(page_size)

    return list(session.scalars(q).all()), total


def get_stock_by_symbol(session: Session, symbol: str) -> Optional[Stock]:
    return session.get(Stock, symbol)


def get_sector_stats(session: Session) -> list[dict]:
    q = (
        select(
            Stock.sector,
            func.avg(Stock.pe_ratio).label("avg_pe"),
            func.avg(Stock.roe).label("avg_roe"),
            func.avg(Stock.debt_to_equity).label("avg_debt_to_equity"),
            func.count().label("stock_count"),
        )
        .where(Stock.sector.isnot(None))
        .group_by(Stock.sector)
        .order_by(func.count().desc())
    )
    return [
        {
            "sector": r.sector,
            "avg_pe": round(r.avg_pe, 2) if r.avg_pe else None,
            "avg_roe": round(r.avg_roe, 2) if r.avg_roe else None,
            "avg_debt_to_equity": round(r.avg_debt_to_equity, 2) if r.avg_debt_to_equity else None,
            "stock_count": r.stock_count,
        }
        for r in session.execute(q).all()
    ]


def get_sector_percentiles(session: Session, symbol: str) -> dict:
    stock = session.get(Stock, symbol)
    if not stock or not stock.sector:
        return {}
    peers = list(session.scalars(select(Stock).where(Stock.sector == stock.sector)).all())

    def pct(val, field, higher_is_better=True):
        if val is None:
            return None
        vals = [getattr(s, field) for s in peers if getattr(s, field) is not None]
        if not vals:
            return None
        rank = sum(1 for v in vals if v <= val)
        raw = round(rank / len(vals) * 100)
        return raw if higher_is_better else 100 - raw

    return {
        "pe_percentile": pct(stock.pe_ratio, "pe_ratio", higher_is_better=False),
        "roe_percentile": pct(stock.roe, "roe"),
        "debt_percentile": pct(stock.debt_to_equity, "debt_to_equity", higher_is_better=False),
        "revenue_growth_percentile": pct(stock.revenue_growth_yoy, "revenue_growth_yoy"),
        "promoter_percentile": pct(stock.promoter_holding, "promoter_holding"),
    }


def get_last_updated(session: Session) -> Optional[str]:
    result = session.scalar(select(func.max(Stock.updated_at)))
    return result.isoformat() if result else None


def get_distinct_sectors(session: Session) -> list[str]:
    return list(session.scalars(
        select(Stock.sector).where(Stock.sector.isnot(None)).distinct().order_by(Stock.sector)
    ).all())
```

- [ ] **Step 5: Run tests — expect pass**

```powershell
pytest tests/test_queries.py -v
```

Expected: all 9 tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/database/queries.py tests/conftest.py tests/test_queries.py pytest.ini
git commit -m "feat: add query builder with filter/sort/paginate + tests"
```

---

### Task 4: yfinance fetcher and tests

**Files:**
- Create: `backend/pipeline/fetcher.py`
- Create: `tests/test_pipeline.py`

- [ ] **Step 1: Write failing tests in `tests/test_pipeline.py`**

```python
import pytest
from unittest.mock import patch, MagicMock
from backend.pipeline.fetcher import _fetch_one, fetch_all, load_symbols
import pandas as pd
import os


def make_ticker_mock(info: dict, financials=None):
    mock = MagicMock()
    mock.info = info
    mock.financials = financials
    return mock


def test_fetch_one_returns_dict_on_valid_data():
    info = {
        "longName": "Reliance Industries",
        "sector": "Energy",
        "marketCap": 15_000_000_000_00,
        "trailingPE": 22.5,
        "returnOnEquity": 0.125,
        "debtToEquity": 50.0,
        "currentRatio": 1.2,
        "currentPrice": 2850.0,
        "fiftyTwoWeekHigh": 3100.0,
    }
    with patch("yfinance.Ticker", return_value=make_ticker_mock(info)):
        result = _fetch_one("RELIANCE")
    assert result is not None
    assert result["symbol"] == "RELIANCE"
    assert result["company_name"] == "Reliance Industries"
    assert result["sector"] == "Energy"
    assert result["roe"] == pytest.approx(12.5, 0.1)


def test_fetch_one_returns_none_on_empty_info():
    with patch("yfinance.Ticker", return_value=make_ticker_mock({})):
        result = _fetch_one("BADTICKER")
    assert result is None


def test_fetch_one_handles_exception():
    mock = MagicMock()
    mock.info = property(lambda self: (_ for _ in ()).throw(Exception("Network error")))
    with patch("yfinance.Ticker", side_effect=Exception("Network error")):
        result = _fetch_one("RELIANCE")
    assert result is None


def test_fetch_all_returns_list_of_valid_results():
    info = {"longName": "Test Corp", "sector": "IT", "currentPrice": 100.0}
    with patch("backend.pipeline.fetcher._fetch_one", return_value={"symbol": "TEST", "company_name": "Test Corp"}):
        results = fetch_all(["TEST", "TEST2"], batch_size=2, delay=0)
    assert len(results) == 2


def test_load_symbols_reads_csv(tmp_path):
    csv = tmp_path / "test.csv"
    csv.write_text("Company Name,Industry,Symbol,Series,ISIN Code\nTest Corp,IT,TESTCORP,EQ,INE001\n")
    symbols = load_symbols(str(csv))
    assert symbols == ["TESTCORP"]
```

- [ ] **Step 2: Run tests — expect fail**

```powershell
pytest tests/test_pipeline.py -v
```

Expected: `ImportError` — `fetcher` doesn't exist yet.

- [ ] **Step 3: Write `backend/pipeline/fetcher.py`**

```python
import logging
import time
from datetime import datetime
from typing import Optional

import pandas as pd
import yfinance as yf

logger = logging.getLogger(__name__)


def _fetch_one(symbol: str) -> Optional[dict]:
    try:
        ticker = yf.Ticker(f"{symbol}.NS")
        info = ticker.info
        if not info or not info.get("longName") and not info.get("shortName"):
            return None

        rev_growth = None
        try:
            fin = ticker.financials
            if fin is not None and not fin.empty and fin.shape[1] >= 2:
                rev_rows = fin[fin.index.str.contains("Revenue", case=False, na=False)]
                if not rev_rows.empty:
                    latest, prev = rev_rows.iloc[0, 0], rev_rows.iloc[0, 1]
                    if prev and prev != 0:
                        rev_growth = round((latest - prev) / abs(prev) * 100, 2)
        except Exception:
            pass

        mc = info.get("marketCap")
        roe_raw = info.get("returnOnEquity")

        return {
            "symbol": symbol,
            "company_name": info.get("longName") or info.get("shortName") or symbol,
            "sector": info.get("sector") or info.get("industry") or "Unknown",
            "market_cap": round(mc / 1e7, 2) if mc else None,
            "pe_ratio": info.get("trailingPE"),
            "roe": round(roe_raw * 100, 2) if roe_raw is not None else None,
            "debt_to_equity": info.get("debtToEquity"),
            "revenue_growth_yoy": rev_growth,
            "current_ratio": info.get("currentRatio"),
            "price": info.get("currentPrice") or info.get("regularMarketPrice"),
            "fifty_two_week_high": info.get("fiftyTwoWeekHigh"),
            "updated_at": datetime.utcnow(),
        }
    except Exception as e:
        logger.warning(f"Failed to fetch {symbol}: {e}")
        return None


def fetch_all(symbols: list[str], batch_size: int = 10, delay: float = 1.0) -> list[dict]:
    results = []
    for i in range(0, len(symbols), batch_size):
        batch = symbols[i : i + batch_size]
        for symbol in batch:
            data = _fetch_one(symbol)
            if data:
                results.append(data)
        if i + batch_size < len(symbols):
            time.sleep(delay)
        logger.info(f"Fetched {min(i + batch_size, len(symbols))}/{len(symbols)}")
    return results


def load_symbols(csv_path: str) -> list[str]:
    df = pd.read_csv(csv_path)
    return df["Symbol"].dropna().tolist()
```

- [ ] **Step 4: Run tests — expect pass**

```powershell
pytest tests/test_pipeline.py -v
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/pipeline/fetcher.py tests/test_pipeline.py
git commit -m "feat: yfinance fundamental fetcher with batch rate limiting"
```

---

### Task 5: NSE shareholding parser and tests

**Files:**
- Modify: `tests/test_pipeline.py` (add holdings tests)
- Create: `backend/pipeline/nse_holdings.py`

- [ ] **Step 1: Add failing tests to `tests/test_pipeline.py`**

Append to the file:

```python
from backend.pipeline.nse_holdings import fetch_promoter_holdings
import zipfile
import io


def make_zip_csv(content: str) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("shpDec2024.csv", content)
    return buf.getvalue()


def test_fetch_promoter_holdings_parses_csv():
    csv = "SYMBOL,PROMOTER AND PROMOTER GROUP,PUBLIC\nRELIANCE,50.1,49.9\nTCS,72.0,28.0\n"
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.content = make_zip_csv(csv)

    with patch("requests.get", return_value=mock_resp):
        result = fetch_promoter_holdings()

    assert result.get("RELIANCE") == pytest.approx(50.1, 0.01)
    assert result.get("TCS") == pytest.approx(72.0, 0.01)


def test_fetch_promoter_holdings_returns_empty_on_failure():
    with patch("requests.get", side_effect=Exception("timeout")):
        result = fetch_promoter_holdings()
    assert result == {}
```

- [ ] **Step 2: Run new tests — expect fail**

```powershell
pytest tests/test_pipeline.py::test_fetch_promoter_holdings_parses_csv -v
```

Expected: `ImportError`.

- [ ] **Step 3: Write `backend/pipeline/nse_holdings.py`**

```python
import io
import logging
import zipfile
from datetime import datetime
from typing import Optional

import pandas as pd
import requests

logger = logging.getLogger(__name__)

_QUARTER_MAP = [(3, "Mar"), (6, "Jun"), (9, "Sep"), (12, "Dec")]


def _candidate_urls() -> list[str]:
    now = datetime.now()
    urls = []
    for year_offset in range(2):
        year = now.year - year_offset
        for _, month_name in reversed(_QUARTER_MAP):
            urls.append(
                f"https://archives.nseindia.com/corporate/shp{month_name}{year}.zip"
            )
    return urls


def fetch_promoter_holdings() -> dict[str, float]:
    for url in _candidate_urls():
        try:
            resp = requests.get(
                url,
                timeout=30,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
            )
            if resp.status_code != 200:
                continue

            with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
                csv_names = [n for n in zf.namelist() if n.endswith(".csv")]
                if not csv_names:
                    continue
                df = pd.read_csv(zf.open(csv_names[0]))

            df.columns = [c.strip().upper() for c in df.columns]
            symbol_col = next((c for c in df.columns if c == "SYMBOL"), None)
            promoter_col = next(
                (c for c in df.columns if "PROMOTER" in c and "TOTAL" not in c), None
            ) or next((c for c in df.columns if "PROMOTER" in c), None)

            if not symbol_col or not promoter_col:
                logger.warning(f"Unexpected columns in {url}: {list(df.columns)}")
                continue

            df[promoter_col] = pd.to_numeric(df[promoter_col], errors="coerce")
            result = {
                str(row[symbol_col]).strip(): float(row[promoter_col])
                for _, row in df.iterrows()
                if pd.notna(row[promoter_col])
            }
            logger.info(f"Loaded promoter holdings for {len(result)} stocks from {url}")
            return result

        except Exception as e:
            logger.warning(f"Failed to load {url}: {e}")
            continue

    logger.error("Could not load NSE promoter holdings from any URL — using empty dict")
    return {}
```

- [ ] **Step 4: Run all pipeline tests — expect pass**

```powershell
pytest tests/test_pipeline.py -v
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/pipeline/nse_holdings.py tests/test_pipeline.py
git commit -m "feat: NSE shareholding CSV parser for promoter holding data"
```

---

### Task 6: Scheduler and pipeline runner

**Files:**
- Create: `backend/pipeline/scheduler.py`

- [ ] **Step 1: Write `backend/pipeline/scheduler.py`**

```python
import asyncio
import logging
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)


async def run_pipeline() -> None:
    from backend.config.settings import settings
    from backend.database.db import SessionLocal
    from backend.database.models import Stock
    from backend.pipeline.fetcher import fetch_all, load_symbols
    from backend.pipeline.nse_holdings import fetch_promoter_holdings

    logger.info("Daily pipeline started")
    loop = asyncio.get_event_loop()

    symbols = await loop.run_in_executor(None, load_symbols, settings.stock_universe_path)
    promoter_map = await loop.run_in_executor(None, fetch_promoter_holdings)
    stocks_data = await loop.run_in_executor(None, fetch_all, symbols)

    session = SessionLocal()
    try:
        for data in stocks_data:
            data["promoter_holding"] = promoter_map.get(data["symbol"])
            existing = session.get(Stock, data["symbol"])
            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
            else:
                session.add(Stock(**data))
        session.commit()
        logger.info(f"Pipeline complete: upserted {len(stocks_data)} stocks")
    finally:
        session.close()


def create_scheduler(hour: int = 6, minute: int = 30) -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        run_pipeline,
        CronTrigger(hour=hour, minute=minute, timezone=ZoneInfo("Asia/Kolkata")),
        id="daily_pipeline",
        replace_existing=True,
    )
    return scheduler
```

- [ ] **Step 2: Verify import**

```powershell
python -c "from backend.pipeline.scheduler import create_scheduler; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/pipeline/scheduler.py
git commit -m "feat: APScheduler daily pipeline runner"
```

---

### Task 7: FastAPI schemas and app entry point

**Files:**
- Create: `backend/api/schemas.py`
- Create: `backend/api/main.py`

- [ ] **Step 1: Write `backend/api/schemas.py`**

```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class StockOut(BaseModel):
    symbol: str
    company_name: Optional[str] = None
    sector: Optional[str] = None
    market_cap: Optional[float] = None
    pe_ratio: Optional[float] = None
    roe: Optional[float] = None
    debt_to_equity: Optional[float] = None
    revenue_growth_yoy: Optional[float] = None
    promoter_holding: Optional[float] = None
    current_ratio: Optional[float] = None
    price: Optional[float] = None
    fifty_two_week_high: Optional[float] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class StockDetailOut(StockOut):
    sector_rank: dict = {}


class StocksResponse(BaseModel):
    stocks: list[StockOut]
    total: int
    last_updated: Optional[str] = None


class SectorOut(BaseModel):
    sector: str
    avg_pe: Optional[float] = None
    avg_roe: Optional[float] = None
    avg_debt_to_equity: Optional[float] = None
    stock_count: int


class MetaOut(BaseModel):
    last_updated: Optional[str] = None
    total_stocks: int
    pipeline_status: str
```

- [ ] **Step 2: Write `backend/api/main.py`**

```python
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.routes import sectors, stocks
from backend.config.settings import settings
from backend.database.db import init_db
from backend.pipeline.scheduler import create_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    scheduler = create_scheduler(settings.pipeline_run_hour, settings.pipeline_run_minute)
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(title="NSE Stock Screener API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(stocks.router, prefix="/api")
app.include_router(sectors.router, prefix="/api")
```

- [ ] **Step 3: Verify app imports**

```powershell
python -c "from backend.api.main import app; print('OK')"
```

Expected: `OK` (scheduler will not start — lifespan only runs on server start).

- [ ] **Step 4: Commit**

```bash
git add backend/api/schemas.py backend/api/main.py
git commit -m "feat: FastAPI app with CORS, lifespan, and APScheduler wiring"
```

---

### Task 8: FastAPI routes and API tests

**Files:**
- Create: `backend/api/routes/stocks.py`
- Create: `backend/api/routes/sectors.py`
- Create: `tests/test_api.py`

- [ ] **Step 1: Write `backend/api/routes/stocks.py`**

```python
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.api.schemas import StockDetailOut, StocksResponse
from backend.database.db import get_session
from backend.database.queries import (
    get_last_updated,
    get_sector_percentiles,
    get_stock_by_symbol,
    get_stocks,
)

router = APIRouter()


@router.get("/stocks", response_model=StocksResponse)
def list_stocks(
    sector: Optional[str] = None,
    pe_min: Optional[float] = None,
    pe_max: Optional[float] = None,
    roe_min: Optional[float] = None,
    debt_max: Optional[float] = None,
    revenue_growth_min: Optional[float] = None,
    promoter_min: Optional[float] = None,
    sort_by: str = Query("market_cap"),
    sort_dir: str = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
):
    stocks, total = get_stocks(
        session, sector, pe_min, pe_max, roe_min,
        debt_max, revenue_growth_min, promoter_min,
        sort_by, sort_dir, page, page_size,
    )
    return StocksResponse(
        stocks=stocks,
        total=total,
        last_updated=get_last_updated(session),
    )


@router.get("/stocks/{symbol}", response_model=StockDetailOut)
def get_stock(symbol: str, session: Session = Depends(get_session)):
    stock = get_stock_by_symbol(session, symbol.upper())
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    rank = get_sector_percentiles(session, symbol.upper())
    return StockDetailOut(**{c.key: getattr(stock, c.key) for c in stock.__table__.columns}, sector_rank=rank)
```

- [ ] **Step 2: Write `backend/api/routes/sectors.py`**

```python
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.api.schemas import MetaOut, SectorOut
from backend.database.db import get_session
from backend.database.models import Stock
from backend.database.queries import get_last_updated, get_sector_stats

router = APIRouter()


@router.get("/sectors", response_model=list[SectorOut])
def list_sectors(session: Session = Depends(get_session)):
    return get_sector_stats(session)


@router.get("/meta", response_model=MetaOut)
def get_meta(session: Session = Depends(get_session)):
    total = session.scalar(select(func.count()).select_from(Stock)) or 0
    last_updated = get_last_updated(session)
    return MetaOut(
        last_updated=last_updated,
        total_stocks=total,
        pipeline_status="ok" if total > 0 else "empty",
    )
```

- [ ] **Step 3: Write `tests/test_api.py`**

```python
import pytest
from datetime import datetime
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database.models import Base, Stock
from backend.database.db import get_session
from backend.api.main import app

TEST_ENGINE = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
Base.metadata.create_all(TEST_ENGINE)
TestSession = sessionmaker(bind=TEST_ENGINE)


def override_session():
    s = TestSession()
    try:
        yield s
    finally:
        s.close()


app.dependency_overrides[get_session] = override_session


@pytest.fixture(autouse=True)
def seed():
    session = TestSession()
    session.query(Stock).delete()
    session.add_all([
        Stock(symbol="RELIANCE", company_name="Reliance Industries", sector="Energy",
              market_cap=1500000.0, pe_ratio=22.5, roe=12.5, updated_at=datetime.utcnow()),
        Stock(symbol="TCS", company_name="TCS", sector="Technology",
              market_cap=1200000.0, pe_ratio=28.0, roe=40.0, updated_at=datetime.utcnow()),
    ])
    session.commit()
    session.close()


@pytest.fixture(scope="module")
def client():
    with patch("backend.api.main.create_scheduler", return_value=MagicMock()):
        with TestClient(app) as c:
            yield c


def test_list_stocks_returns_200(client):
    resp = client.get("/api/stocks")
    assert resp.status_code == 200
    body = resp.json()
    assert "stocks" in body
    assert "total" in body
    assert body["total"] == 2


def test_list_stocks_sector_filter(client):
    resp = client.get("/api/stocks?sector=Technology")
    assert resp.status_code == 200
    stocks = resp.json()["stocks"]
    assert len(stocks) == 1
    assert stocks[0]["symbol"] == "TCS"


def test_list_stocks_pe_max_filter(client):
    resp = client.get("/api/stocks?pe_max=25")
    assert resp.status_code == 200
    for s in resp.json()["stocks"]:
        assert s["pe_ratio"] <= 25


def test_get_stock_detail(client):
    resp = client.get("/api/stocks/RELIANCE")
    assert resp.status_code == 200
    body = resp.json()
    assert body["symbol"] == "RELIANCE"
    assert "sector_rank" in body


def test_get_stock_not_found(client):
    resp = client.get("/api/stocks/NOTEXIST")
    assert resp.status_code == 404


def test_list_sectors(client):
    resp = client.get("/api/sectors")
    assert resp.status_code == 200
    sectors = [s["sector"] for s in resp.json()]
    assert "Energy" in sectors


def test_get_meta(client):
    resp = client.get("/api/meta")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_stocks"] == 2
    assert body["pipeline_status"] == "ok"
```

- [ ] **Step 4: Run all tests**

```powershell
pytest tests/ -v
```

Expected: all tests pass.

- [ ] **Step 5: Smoke test the running server**

```powershell
$env:CORS_ORIGINS = "http://localhost:5173"
uvicorn backend.api.main:app --reload --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000/api/meta` in browser — expect `{"last_updated":null,"total_stocks":0,"pipeline_status":"empty"}` (DB is empty until pipeline runs).

Open `http://localhost:8000/docs` — confirm Swagger UI shows all endpoints.

- [ ] **Step 6: Commit**

```bash
git add backend/api/routes/ tests/test_api.py
git commit -m "feat: FastAPI routes for stocks, sectors, meta with full test coverage"
```

---

### Task 9: Frontend scaffold with Tailwind

**Files:**
- Create: `frontend/` (Vite React TS app)
- Create: `frontend/src/index.css`
- Modify: `frontend/index.html`
- Create: `frontend/tailwind.config.js`

- [ ] **Step 1: Scaffold Vite app**

```powershell
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

- [ ] **Step 2: Install dependencies**

```powershell
npm install @tanstack/react-query @tanstack/react-table
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 3: Write `frontend/tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

- [ ] **Step 4: Replace `frontend/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif; }
}
```

- [ ] **Step 5: Add Inter font to `frontend/index.html`**

Replace the `<head>` section:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <title>NSE Screener</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Update `frontend/src/index.css` to use Inter**

Add to the `@layer base` block:

```css
body { font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
```

- [ ] **Step 7: Clean up default Vite files**

```powershell
Remove-Item -Force src\App.css
Remove-Item -Force src\assets\react.svg
```

- [ ] **Step 8: Write `frontend/.env.example`**

```
VITE_API_URL=http://localhost:8000
```

- [ ] **Step 9: Verify dev server starts**

```powershell
npm run dev
```

Open `http://localhost:5173` — expect the default Vite page (we haven't replaced App.tsx yet).

- [ ] **Step 10: Commit**

```bash
cd ..
git add frontend/
git commit -m "feat: scaffold React frontend with Vite, TypeScript, Tailwind CSS"
```

---

### Task 10: Frontend types, API client, and hooks

**Files:**
- Create: `frontend/src/types/stock.ts`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/hooks/useStocks.ts`

- [ ] **Step 1: Write `frontend/src/types/stock.ts`**

```typescript
export interface Stock {
  symbol: string;
  company_name: string | null;
  sector: string | null;
  market_cap: number | null;
  pe_ratio: number | null;
  roe: number | null;
  debt_to_equity: number | null;
  revenue_growth_yoy: number | null;
  promoter_holding: number | null;
  current_ratio: number | null;
  price: number | null;
  fifty_two_week_high: number | null;
  updated_at: string | null;
}

export interface StockDetail extends Stock {
  sector_rank: {
    pe_percentile?: number | null;
    roe_percentile?: number | null;
    debt_percentile?: number | null;
    revenue_growth_percentile?: number | null;
    promoter_percentile?: number | null;
  };
}

export interface StocksResponse {
  stocks: Stock[];
  total: number;
  last_updated: string | null;
}

export interface Sector {
  sector: string;
  avg_pe: number | null;
  avg_roe: number | null;
  avg_debt_to_equity: number | null;
  stock_count: number;
}

export interface Meta {
  last_updated: string | null;
  total_stocks: number;
  pipeline_status: string;
}

export interface Filters {
  sector: string;
  pe_min: string;
  pe_max: string;
  roe_min: string;
  debt_max: string;
  revenue_growth_min: string;
  promoter_min: string;
}
```

- [ ] **Step 2: Write `frontend/src/lib/api.ts`**

```typescript
import type { Filters, Meta, Sector, StockDetail, StocksResponse } from "../types/stock";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

export function fetchStocks(
  filters: Filters,
  sortBy: string,
  sortDir: string,
  page: number,
  pageSize = 20,
): Promise<StocksResponse> {
  const p = new URLSearchParams({ sort_by: sortBy, sort_dir: sortDir, page: String(page), page_size: String(pageSize) });
  if (filters.sector) p.set("sector", filters.sector);
  if (filters.pe_min) p.set("pe_min", filters.pe_min);
  if (filters.pe_max) p.set("pe_max", filters.pe_max);
  if (filters.roe_min) p.set("roe_min", filters.roe_min);
  if (filters.debt_max) p.set("debt_max", filters.debt_max);
  if (filters.revenue_growth_min) p.set("revenue_growth_min", filters.revenue_growth_min);
  if (filters.promoter_min) p.set("promoter_min", filters.promoter_min);
  return get<StocksResponse>(`/api/stocks?${p}`);
}

export const fetchStock = (symbol: string): Promise<StockDetail> =>
  get<StockDetail>(`/api/stocks/${symbol}`);

export const fetchSectors = (): Promise<Sector[]> => get<Sector[]>("/api/sectors");

export const fetchMeta = (): Promise<Meta> => get<Meta>("/api/meta");
```

- [ ] **Step 3: Write `frontend/src/hooks/useStocks.ts`**

```typescript
import { useQuery } from "@tanstack/react-query";
import { fetchMeta, fetchSectors, fetchStock, fetchStocks } from "../lib/api";
import type { Filters } from "../types/stock";

export function useStocks(filters: Filters, sortBy: string, sortDir: string, page: number) {
  return useQuery({
    queryKey: ["stocks", filters, sortBy, sortDir, page],
    queryFn: () => fetchStocks(filters, sortBy, sortDir, page),
    placeholderData: (prev) => prev,
  });
}

export function useSectors() {
  return useQuery({ queryKey: ["sectors"], queryFn: fetchSectors, staleTime: 5 * 60 * 1000 });
}

export function useMeta() {
  return useQuery({ queryKey: ["meta"], queryFn: fetchMeta, refetchInterval: 60_000 });
}

export function useStockDetail(symbol: string | null) {
  return useQuery({
    queryKey: ["stock", symbol],
    queryFn: () => fetchStock(symbol!),
    enabled: !!symbol,
  });
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```powershell
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd ..
git add frontend/src/types/ frontend/src/lib/ frontend/src/hooks/
git commit -m "feat: frontend types, API client, and TanStack Query hooks"
```

---

### Task 11: FilterPanel component

**Files:**
- Create: `frontend/src/components/FilterPanel.tsx`

- [ ] **Step 1: Write `frontend/src/components/FilterPanel.tsx`**

```tsx
import type { Filters } from "../types/stock";

interface Props {
  filters: Filters;
  sectors: string[];
  onChange: (f: Filters) => void;
  onReset: () => void;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
      {children}
    </p>
  );
}

function NumInput({
  label, field, value, onChange, placeholder,
}: {
  label: string; field: keyof Filters; value: string;
  onChange: (f: keyof Filters, v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="number"
        value={value}
        placeholder={placeholder ?? "—"}
        onChange={(e) => onChange(field, e.target.value)}
        className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );
}

export function FilterPanel({ filters, sectors, onChange, onReset }: Props) {
  const set = (field: keyof Filters, v: string) => onChange({ ...filters, [field]: v });
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-slate-200 sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto">
      <div className="p-5 space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Filters</span>
          {hasFilters && (
            <button
              onClick={onReset}
              className="text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              Reset all
            </button>
          )}
        </div>

        {/* Sector */}
        <div>
          <Label>Sector</Label>
          <select
            value={filters.sector}
            onChange={(e) => set("sector", e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All sectors</option>
            {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* P/E */}
        <div>
          <Label>P/E Ratio</Label>
          <div className="grid grid-cols-2 gap-2">
            <NumInput label="Min" field="pe_min" value={filters.pe_min} onChange={set} placeholder="0" />
            <NumInput label="Max" field="pe_max" value={filters.pe_max} onChange={set} placeholder="100" />
          </div>
        </div>

        <NumInput label="ROE min (%)" field="roe_min" value={filters.roe_min} onChange={set} placeholder="0" />
        <NumInput label="Debt / Equity max" field="debt_max" value={filters.debt_max} onChange={set} placeholder="2" />
        <NumInput label="Rev growth min (%)" field="revenue_growth_min" value={filters.revenue_growth_min} onChange={set} placeholder="0" />
        <NumInput label="Promoter holding min (%)" field="promoter_min" value={filters.promoter_min} onChange={set} placeholder="0" />
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd ..
git add frontend/src/components/FilterPanel.tsx
git commit -m "feat: FilterPanel sidebar component with sector dropdown and metric inputs"
```

---

### Task 12: StockTable component

**Files:**
- Create: `frontend/src/components/StockTable.tsx`

- [ ] **Step 1: Write `frontend/src/components/StockTable.tsx`**

```tsx
import {
  createColumnHelper, flexRender,
  getCoreRowModel, useReactTable,
} from "@tanstack/react-table";
import type { Stock } from "../types/stock";

const col = createColumnHelper<Stock>();

const dash = <span className="text-slate-300">—</span>;

function fmt(v: number | null | undefined, d = 1) {
  return v != null ? v.toFixed(d) : dash;
}

function pctCell(v: number | null | undefined) {
  if (v == null) return dash;
  const cls = v > 0 ? "text-emerald-600" : v < 0 ? "text-red-500" : "text-slate-400";
  return <span className={cls}>{v.toFixed(1)}%</span>;
}

function capCell(v: number | null | undefined) {
  if (v == null) return dash;
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(1)}L Cr`;
  if (v >= 1_000) return `₹${(v / 1_000).toFixed(1)}K Cr`;
  return `₹${v.toFixed(0)} Cr`;
}

const COLUMNS = [
  col.accessor("symbol", {
    header: "Symbol",
    cell: (i) => <span className="font-semibold text-slate-900">{i.getValue()}</span>,
  }),
  col.accessor("company_name", {
    header: "Company",
    cell: (i) => (
      <span className="text-slate-600 text-sm truncate max-w-[150px] block" title={i.getValue() ?? ""}>
        {i.getValue() ?? dash}
      </span>
    ),
  }),
  col.accessor("sector", {
    header: "Sector",
    cell: (i) => i.getValue()
      ? <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">{i.getValue()}</span>
      : dash,
  }),
  col.accessor("price", {
    header: "Price",
    cell: (i) => i.getValue() != null ? `₹${i.getValue()!.toFixed(2)}` : dash,
  }),
  col.accessor("pe_ratio", { header: "P/E", cell: (i) => fmt(i.getValue()) }),
  col.accessor("roe", { header: "ROE", cell: (i) => pctCell(i.getValue()) }),
  col.accessor("debt_to_equity", { header: "D/E", cell: (i) => fmt(i.getValue(), 2) }),
  col.accessor("revenue_growth_yoy", { header: "Rev Growth", cell: (i) => pctCell(i.getValue()) }),
  col.accessor("promoter_holding", { header: "Promoter", cell: (i) => fmt(i.getValue()) !== dash ? `${i.getValue()!.toFixed(1)}%` : dash }),
  col.accessor("market_cap", { header: "Mkt Cap", cell: (i) => capCell(i.getValue()) }),
];

interface Props {
  stocks: Stock[];
  total: number;
  page: number;
  pageSize: number;
  sortBy: string;
  sortDir: "asc" | "desc";
  isLoading: boolean;
  onSort: (col: string) => void;
  onPage: (p: number) => void;
  onRowClick: (symbol: string) => void;
}

export function StockTable({ stocks, total, page, pageSize, sortBy, sortDir, isLoading, onSort, onPage, onRowClick }: Props) {
  const table = useReactTable({ data: stocks, columns: COLUMNS, getCoreRowModel: getCoreRowModel(), manualSorting: true });
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {isLoading ? "Loading…" : `${total.toLocaleString()} stocks`}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="bg-slate-50 border-b border-slate-200">
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      onClick={() => onSort(h.column.id)}
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-700 select-none whitespace-nowrap"
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {sortBy === h.column.id && (
                        <span className="ml-1 text-blue-500">{sortDir === "desc" ? "↓" : "↑"}</span>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {COLUMNS.map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-slate-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                : stocks.length === 0
                ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-4 py-16 text-center text-slate-400 text-sm">
                      No stocks match your filters
                    </td>
                  </tr>
                )
                : table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => onRowClick(row.original.symbol)}
                      className="border-b border-slate-100 hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-slate-400">Page {page} of {totalPages}</p>
          <div className="flex gap-1">
            <button onClick={() => onPage(page - 1)} disabled={page === 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50">←</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
              if (p < 1 || p > totalPages) return null;
              return (
                <button key={p} onClick={() => onPage(p)}
                  className={`px-3 py-1.5 text-sm rounded-lg border ${p === page ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 hover:bg-slate-50"}`}>
                  {p}
                </button>
              );
            })}
            <button onClick={() => onPage(page + 1)} disabled={page === totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50">→</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd ..
git add frontend/src/components/StockTable.tsx
git commit -m "feat: StockTable with TanStack Table, sort indicators, pagination, skeleton loading"
```

---

### Task 13: StockDetailModal and App assembly

**Files:**
- Create: `frontend/src/components/StockDetailModal.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Write `frontend/src/components/StockDetailModal.tsx`**

```tsx
import { useEffect } from "react";
import { useStockDetail } from "../hooks/useStocks";

interface Props { symbol: string; onClose: () => void; }

function Row({ label, value, percentile, higherBetter = true }: {
  label: string; value: string | null; percentile?: number | null; higherBetter?: boolean;
}) {
  const pctColor = percentile == null ? "" :
    higherBetter
      ? percentile >= 66 ? "text-emerald-600" : percentile >= 33 ? "text-amber-500" : "text-red-500"
      : percentile <= 33 ? "text-emerald-600" : percentile <= 66 ? "text-amber-500" : "text-red-500";

  return (
    <div className="flex justify-between items-center py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-slate-800">{value ?? "—"}</span>
        {percentile != null && (
          <span className={`text-xs font-semibold ${pctColor}`}>{percentile}th pct</span>
        )}
      </div>
    </div>
  );
}

export function StockDetailModal({ symbol, onClose }: Props) {
  const { data, isLoading } = useStockDetail(symbol);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const f = (v: number | null | undefined, suffix = "", d = 1) =>
    v != null ? `${v.toFixed(d)}${suffix}` : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start p-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{symbol}</h2>
            {data && (
              <>
                <p className="text-sm text-slate-500 mt-0.5">{data.company_name}</p>
                <span className="inline-block mt-2 px-2.5 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
                  {data.sector}
                </span>
              </>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-8 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : data ? (
          <div className="p-6">
            {data.price != null && (
              <div className="mb-5 p-4 bg-slate-50 rounded-xl">
                <p className="text-2xl font-bold text-slate-900">₹{data.price.toFixed(2)}</p>
                {data.fifty_two_week_high != null && (
                  <p className="text-xs text-slate-400 mt-1">52W High: ₹{data.fifty_two_week_high.toFixed(2)}</p>
                )}
              </div>
            )}
            <Row label="P/E Ratio" value={f(data.pe_ratio)} percentile={data.sector_rank?.pe_percentile} higherBetter={false} />
            <Row label="ROE" value={f(data.roe, "%")} percentile={data.sector_rank?.roe_percentile} />
            <Row label="Debt / Equity" value={f(data.debt_to_equity, "", 2)} percentile={data.sector_rank?.debt_percentile} higherBetter={false} />
            <Row label="Revenue Growth (YoY)" value={f(data.revenue_growth_yoy, "%")} percentile={data.sector_rank?.revenue_growth_percentile} />
            <Row label="Promoter Holding" value={f(data.promoter_holding, "%")} percentile={data.sector_rank?.promoter_percentile} />
            <Row label="Current Ratio" value={f(data.current_ratio)} />
            <Row label="Market Cap" value={data.market_cap ? `₹${(data.market_cap / 1000).toFixed(1)}K Cr` : null} />
          </div>
        ) : (
          <p className="p-6 text-sm text-slate-400 text-center">Failed to load stock data.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `frontend/src/App.tsx`**

```tsx
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FilterPanel } from "./components/FilterPanel";
import { StockTable } from "./components/StockTable";
import { StockDetailModal } from "./components/StockDetailModal";
import { useMeta, useSectors, useStocks } from "./hooks/useStocks";
import type { Filters } from "./types/stock";

const queryClient = new QueryClient();

const DEFAULT_FILTERS: Filters = {
  sector: "", pe_min: "", pe_max: "", roe_min: "",
  debt_max: "", revenue_growth_min: "", promoter_min: "",
};

function Screener() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState("market_cap");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading } = useStocks(filters, sortBy, sortDir, page);
  const { data: sectors } = useSectors();
  const { data: meta } = useMeta();

  const handleSort = (col: string) => {
    if (col === sortBy) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSortBy(col); setSortDir("desc"); }
    setPage(1);
  };

  const handleFilters = (f: Filters) => { setFilters(f); setPage(1); };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 h-[57px] flex items-center px-6 gap-3">
        <div className="flex items-baseline gap-2">
          <h1 className="text-base font-bold text-slate-900 tracking-tight">NSE Screener</h1>
          <span className="text-xs text-slate-400 font-medium">NIFTY 500</span>
        </div>
        <div className="ml-auto flex items-center gap-4 text-xs text-slate-400">
          {meta?.total_stocks ? <span>{meta.total_stocks.toLocaleString()} stocks</span> : null}
          {meta?.last_updated ? (
            <span>
              Updated{" "}
              {new Date(meta.last_updated).toLocaleDateString("en-IN", {
                day: "numeric", month: "short", year: "numeric",
              })}
            </span>
          ) : null}
          {meta?.pipeline_status === "empty" && (
            <span className="text-amber-500 font-medium">Pipeline not yet run</span>
          )}
        </div>
      </header>

      <div className="flex">
        <FilterPanel
          filters={filters}
          sectors={(sectors ?? []).map((s) => s.sector)}
          onChange={handleFilters}
          onReset={() => { setFilters(DEFAULT_FILTERS); setPage(1); }}
        />
        <main className="flex-1 p-6 min-w-0">
          <StockTable
            stocks={data?.stocks ?? []}
            total={data?.total ?? 0}
            page={page}
            pageSize={20}
            sortBy={sortBy}
            sortDir={sortDir}
            isLoading={isLoading}
            onSort={handleSort}
            onPage={setPage}
            onRowClick={setSelected}
          />
        </main>
      </div>

      {selected && <StockDetailModal symbol={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Screener />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 3: Update `frontend/src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 4: Run TypeScript check**

```powershell
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Start backend and frontend — verify end-to-end**

Terminal 1 (backend):
```powershell
uvicorn backend.api.main:app --reload --port 8000
```

Terminal 2 (frontend):
```powershell
cd frontend && npm run dev
```

Open `http://localhost:5173`. Confirm:
- Header shows "NSE Screener / NIFTY 500"
- Filter sidebar renders on the left
- Table renders (empty state since pipeline hasn't run yet)
- No console errors

- [ ] **Step 6: Manually trigger pipeline to populate DB**

In a third terminal:
```powershell
python -c "import asyncio; from backend.pipeline.scheduler import run_pipeline; asyncio.run(run_pipeline())"
```

Wait ~10-30 minutes for 500 stocks to be fetched. After completion, refresh `http://localhost:5173` — table should now show stocks.

- [ ] **Step 7: Commit**

```bash
cd ..
git add frontend/src/
git commit -m "feat: StockDetailModal, App assembly — full screener UI working end-to-end"
```

---

### Task 14: Deployment configuration and README

**Files:**
- Create: `railway.toml`
- Create: `frontend/vercel.json`
- Create: `.env.example`
- Create: `frontend/.env.example`
- Modify: `README.md`

- [ ] **Step 1: Write `railway.toml`**

```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "uvicorn backend.api.main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/api/meta"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

- [ ] **Step 2: Write `frontend/vercel.json`**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

- [ ] **Step 3: Write `.env.example`** (project root)

```
# Database — use SQLite locally, set to PostgreSQL URL on Railway
DATABASE_URL=sqlite:///./nse_screener.db

# Pipeline schedule (IST, 24h)
PIPELINE_RUN_HOUR=6
PIPELINE_RUN_MINUTE=30

# CORS — add your Vercel URL after deploying
CORS_ORIGINS=http://localhost:5173,https://your-app.vercel.app

# Path to NIFTY 500 symbol list
STOCK_UNIVERSE_PATH=data/nifty500.csv
```

- [ ] **Step 4: Write `frontend/.env.example`**

```
# Set to your Railway backend URL after deploying
VITE_API_URL=http://localhost:8000
```

- [ ] **Step 5: Write `README.md`**

```markdown
# NSE Stock Screener

Screen NIFTY 500 stocks by real fundamentals — P/E, ROE, Debt/Equity, Revenue Growth, and Promoter Holding. Fast filters, clean UI, sub-second results.

**Live demo:** [your-app.vercel.app](https://your-app.vercel.app)

## Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + TanStack Table/Query
- **Backend:** FastAPI + SQLAlchemy + APScheduler
- **Data:** yfinance + NSE public shareholding CSVs
- **DB:** SQLite (dev) / PostgreSQL (prod)
- **Deploy:** Vercel (frontend) + Railway (backend)

## How it works

A daily background pipeline (APScheduler, 6:30 AM IST) fetches fundamentals for all 500 stocks and stores them in a database. The API serves pre-computed data — no live scraping on request, sub-second filter response.

## Local development

```bash
# Backend
pip install -r requirements.txt
cp .env.example .env
uvicorn backend.api.main:app --reload --port 8000

# Seed data (first run only — takes ~20 min for 500 stocks)
python -c "import asyncio; from backend.pipeline.scheduler import run_pipeline; asyncio.run(run_pipeline())"

# Frontend
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Deploy

**Backend (Railway):**
1. Connect repo, set root directory to `/`
2. Add env var: `DATABASE_URL=postgresql://...` (Railway provides this)
3. Add env var: `CORS_ORIGINS=https://your-app.vercel.app`
4. Deploy — Railway uses `railway.toml` for start command

**Frontend (Vercel):**
1. Connect repo, set root directory to `frontend/`
2. Add env var: `VITE_API_URL=https://your-app.railway.app`
3. Deploy

## Metrics

| Metric | Source |
|---|---|
| P/E Ratio | yfinance |
| ROE (%) | yfinance |
| Debt / Equity | yfinance |
| Revenue Growth YoY | yfinance quarterly financials |
| Promoter Holding (%) | NSE shareholding CSV archives |
| Market Cap | yfinance |
```

- [ ] **Step 6: Run full test suite one final time**

```powershell
pytest tests/ -v
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add railway.toml frontend/vercel.json .env.example frontend/.env.example README.md
git commit -m "chore: deployment config for Railway + Vercel, updated README"
```

---

**Phase 1 complete.** The app is ready to deploy. Backend on Railway, frontend on Vercel — set the two env vars and both services are live.

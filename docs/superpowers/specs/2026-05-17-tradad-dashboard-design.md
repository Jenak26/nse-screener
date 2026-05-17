# TraDad Dashboard — Design Spec
**Date:** 2026-05-17  
**Status:** Approved  
**Approach:** 3 phases, progressive depth

---

## Project Summary

A professional stock market intelligence dashboard for Indian equity markets (NSE). Scans NIFTY 500 stocks for technical patterns, ranks momentum, tracks sector strength, and sends Telegram alerts. Built for a retail trader covering both intraday and swing timeframes.

**Core principle:** Background workers scan continuously. Dashboard only reads stored results. Response time < 5 seconds for any page.

**Stock universe:** NIFTY 500 (all scans), filtered to F&O eligible list where applicable (~180 stocks).

**Data source:** Angel One SmartAPI (primary — real-time WebSocket + historical REST). yfinance (fallback — market closed / historical backfill).

**Budget:** ₹0/month for Phase 1 and 2. Optional VPS (~₹500–1500/month) in Phase 3.

---

## Architecture

```
Angel One WebSocket (live ticks)
Angel One Historical API (candle backfill)
yfinance (fallback)
        ↓
Data Fetcher (backend/data_fetcher/)
        ↓
OHLC Candle Builder → SQLite DB
        ↓
APScheduler (1m / 5m / 15m / 1H / Daily jobs)
        ↓
Pattern Detection Engine (backend/patterns/)
        ↓
Scoring Engine (backend/scoring/)
        ↓
Sector Strength Engine (backend/sectors/)
        ↓
Signal DB (detected_patterns table)
        ↓
Streamlit Dashboard (app/) — reads DB only, never scans live
        ↓
Telegram Alerts (backend/alerts/)
```

---

## Folder Structure

```
tradad/
├── app/
│   ├── main_app.py             ← Streamlit entry point
│   ├── pages/
│   │   ├── 01_home.py
│   │   ├── 02_pattern_scanner.py
│   │   ├── 03_momentum_rankings.py   (Phase 2)
│   │   ├── 04_breakout_detection.py  (Phase 2)
│   │   ├── 05_vwap_intraday.py       (Phase 2)
│   │   ├── 06_sector_rotation.py     (Phase 2)
│   │   ├── 07_relative_strength.py   (Phase 2)
│   │   ├── 08_volume_analysis.py     (Phase 2)
│   │   ├── 09_watchlist.py           (Phase 2)
│   │   ├── 10_stock_detail.py        (Phase 2)
│   │   ├── 11_options_ideas.py       (Phase 2)
│   │   └── 12_backtesting.py         (Phase 3)
│   └── components/
│       ├── tables.py
│       ├── charts.py
│       └── metrics.py
├── backend/
│   ├── data_fetcher/
│   │   ├── angel_one.py        ← SmartAPI client
│   │   ├── yfinance_client.py  ← fallback
│   │   └── nse_client.py       ← nsepython wrapper
│   ├── websocket/
│   │   └── feed.py             ← Angel One WebSocket handler
│   ├── scanners/
│   │   └── scan_runner.py      ← orchestrates all pattern scans
│   ├── patterns/
│   │   ├── base.py             ← PatternResult dataclass + base interface
│   │   ├── hammer.py
│   │   ├── engulfing.py
│   │   ├── morning_star.py
│   │   ├── doji.py
│   │   ├── orb.py
│   │   ├── vwap_bounce.py
│   │   ├── volume_breakout.py
│   │   ├── gap_up.py
│   │   ├── shooting_star.py      (Phase 2)
│   │   ├── double_bottom.py      (Phase 2)
│   │   ├── double_top.py         (Phase 2)
│   │   ├── bull_flag.py          (Phase 2)
│   │   ├── triangle.py           (Phase 2)
│   │   ├── cup_handle.py         (Phase 2)
│   │   ├── rsi_divergence.py     (Phase 2)
│   │   ├── macd_crossover.py     (Phase 2)
│   │   ├── ema_crossover.py      (Phase 2)
│   │   ├── bollinger_squeeze.py  (Phase 2)
│   │   ├── ath_breakout.py       (Phase 2)
│   │   └── consolidation_breakout.py (Phase 2)
│   ├── indicators/
│   │   ├── vwap.py
│   │   ├── relative_strength.py
│   │   └── momentum.py
│   ├── scoring/
│   │   └── scorer.py
│   ├── alerts/
│   │   └── telegram.py
│   ├── sectors/
│   │   └── sector_engine.py
│   └── rankings/
│       └── momentum_ranker.py
├── database/
│   ├── models.py               ← SQLAlchemy models
│   ├── db.py                   ← session / engine setup
│   └── queries.py              ← common read queries
├── config/
│   └── settings.py             ← loads .env
├── data/
│   └── nifty500.csv            ← stock list with sector + F&O flag
├── logs/
├── tests/
├── utils/
│   └── time_utils.py           ← market hours check, IST helpers
├── .env                        ← secrets (gitignored)
├── .gitignore
├── main.py                     ← starts scheduler + launches dashboard
└── requirements.txt
```

---

## Database Schema

```sql
-- Master stock list
CREATE TABLE stocks (
    symbol TEXT PRIMARY KEY,
    company_name TEXT,
    sector TEXT,
    market_cap REAL,
    is_fno INTEGER DEFAULT 0,
    lot_size INTEGER
);

-- OHLCV candles for all timeframes
CREATE TABLE candles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL,       -- '5m','15m','1H','Daily','Weekly'
    timestamp INTEGER NOT NULL,    -- Unix epoch (IST)
    open REAL, high REAL, low REAL, close REAL, volume INTEGER,
    UNIQUE(symbol, timeframe, timestamp)
);
CREATE INDEX idx_candles ON candles(symbol, timeframe, timestamp);

-- Pattern signals
CREATE TABLE detected_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    pattern_name TEXT NOT NULL,
    confidence_score INTEGER NOT NULL,
    trend_direction TEXT,          -- 'bullish','bearish','neutral'
    volume_confirmation INTEGER DEFAULT 0,
    detected_at INTEGER NOT NULL,  -- Unix epoch
    UNIQUE(symbol, pattern_name, timeframe, detected_at)
);
CREATE INDEX idx_patterns ON detected_patterns(detected_at DESC, confidence_score DESC);

-- Sector strength
CREATE TABLE sector_strength (
    sector TEXT PRIMARY KEY,
    strength_score REAL,
    momentum_score REAL,
    updated_at INTEGER
);

-- Telegram alerts log (for duplicate suppression)
CREATE TABLE alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT,
    alert_type TEXT,
    message TEXT,
    sent_at INTEGER
);

-- Watchlists (Phase 2)
CREATE TABLE watchlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    notes TEXT,
    tags TEXT,
    added_at INTEGER
);
```

---

## Phase 1 — Foundation + MVP Scanner

**Deliverable:** A working scanner and dashboard your father can use from day one.

### 1.1 Environment & Config

- Python 3.12 virtual environment
- `python-dotenv` loads `.env` into `config/settings.py`
- All secrets (API keys, Telegram token) via environment variables only
- `.gitignore` covers `.env`, `*.db`, `logs/`, `__pycache__/`

### 1.2 Data Pipeline

**Angel One client** (`backend/data_fetcher/angel_one.py`):
- Login with TOTP automation using `pyotp`
- `get_candle_data(symbol, timeframe, from_date, to_date)` — historical REST
- `get_ltp(symbols)` — last traded price for multiple symbols
- Token refresh handled automatically (Angel One tokens expire daily)

**WebSocket feed** (`backend/websocket/feed.py`):
- Subscribes to NIFTY 500 symbols on Angel One WebSocket
- Builds 5m and 15m candles from tick data in memory
- Flushes completed candles to DB

**yfinance client** (`backend/data_fetcher/yfinance_client.py`):
- Used for historical backfill (appends `.NS` suffix)
- Used when market is closed (no WebSocket connection needed)

**Scheduler jobs** (`main.py` via APScheduler):
```
Every 1m  → flush WebSocket candles to DB
Every 5m  → run 5m pattern scans (intraday patterns only)
Every 15m → run 15m pattern scans
Every 1H  → run 1H pattern scans + sector strength update
Daily 18:00 IST → run Daily/Weekly pattern scans + backfill
Daily 09:00 IST → login to Angel One, start WebSocket
Daily 15:35 IST → close WebSocket, run EOD scans
```

**Market hours guard:** All live-data jobs check `is_market_open()` before running.

**Candle retention:** Auto-purge candles older than 30 days (5m/15m), 1 year (Daily/Weekly).

### 1.3 Pattern Engine

Each pattern in `backend/patterns/` implements:

```python
from backend.patterns.base import PatternResult
import pandas as pd

def detect(candles: pd.DataFrame) -> PatternResult:
    ...
    return PatternResult(
        detected=True,
        confidence=87,          # 0–100
        direction="bullish",    # or "bearish" / "neutral"
        metadata={"wick_ratio": 2.3}
    )
```

`PatternResult` is a dataclass defined in `base.py`. `scan_runner.py` loops over all symbols × patterns × timeframes, calls `detect()`, and writes results to `detected_patterns` table if `detected=True`.

**Phase 1 patterns (8):**

| Pattern | Logic summary | Timeframes |
|---|---|---|
| Hammer | lower wick > 2× body, close near high, small upper wick | 15m, 1H, Daily |
| Bullish Engulfing | prev bearish, curr bullish, curr body engulfs prev body | 15m, 1H, Daily |
| Morning Star | 3-candle: bearish → small body → bullish close above midpoint | 1H, Daily |
| Doji | body < 10% of total range, wicks balanced | 15m, 1H, Daily |
| ORB | 15m opening range established, breakout above range + volume spike | 5m, 15m |
| VWAP Bounce | price retraces to VWAP, bullish rejection candle, volume > 1.5× avg | 5m, 15m |
| Volume Breakout | volume > 2.5× 20-period average on up candle | 15m, 1H, Daily |
| Gap Up Momentum | open > prev close by 0.5%+, sustained above prev high, volume confirmation | Daily, 15m |

**Phase 1 confidence scoring (basic — 2 factors):**

```
Pattern quality score (0–60)  — based on how cleanly pattern conditions are met
Volume confirmation (0–40)    — volume vs 20-period average
─────────────────────────────
Total: 0–100
```

Full weighted scoring (5 factors) added in Phase 2.

### 1.4 Dashboard — Phase 1

**Page 1: Home (`01_home.py`)**

- Auto-refreshes every 15 seconds (Streamlit `st.rerun()`)
- **Market Overview row:** NIFTY | BANKNIFTY | FINNIFTY — LTP, change%, trend direction (Bullish if price > 20 EMA on 15m, else Bearish), simple colour indicator (green/red)
- **Top 50 Momentum Stocks table:** Ranked by (price change% × volume ratio). Columns: Symbol | LTP | Change% | Volume Ratio | Sector | F&O
- **Top 50 F&O Stocks table:** Same ranking, filtered to `is_fno = 1` stocks only. Separate tab.
- **Live Alerts Feed:** Last 20 signals from `detected_patterns`, sorted by `detected_at` DESC. Columns: Time | Symbol | Pattern | Confidence | TF
- **Sector Strength bar chart:** Horizontal bar chart of all sectors by average momentum score (top 5 green, bottom 5 red)

**Page 2: Pattern Scanner (`02_pattern_scanner.py`)**

- **Sidebar filters:**
  - Pattern selector (multi-select from 8 Phase 1 patterns)
  - Timeframe filter (5m / 15m / 1H / Daily — multi-select)
  - Confidence slider (min 50, default 70)
  - Sector filter (dropdown, all sectors from stocks table)
  - F&O only toggle
- **Main table:** Reads from `detected_patterns` where `detected_at > now - 24h`. Columns: Symbol | Pattern | Confidence | Timeframe | Direction | Volume | Sector | Detected At
- Sortable columns. Colour-coded confidence (green ≥ 80, yellow 65–79, orange < 65)
- **No live scan on click.** Results are pre-computed by background scanner.
- Refresh button forces `st.rerun()`

### 1.5 Telegram Alerts

- Fires when `confidence_score >= 70`
- Duplicate suppression: skip if same symbol + pattern + timeframe already alerted within last 60 minutes (checked against `alerts` table)
- Message format:
  ```
  🔔 RELIANCE | Morning Star | Daily
  Confidence: 88% | Volume: High | Trend: Bullish
  Sector: Energy ↑ | 17-May 14:32 IST
  ```
- Errors logged but never crash the scanner

### 1.6 Requirements (Phase 1)

```
# requirements.txt
streamlit>=1.35
plotly>=5.20
pandas>=2.2
numpy>=1.26
pandas-ta>=0.3.14b
yfinance>=0.2.38
smartapi-python>=1.3.0       # Angel One SmartAPI
pyotp>=2.9                   # TOTP for Angel One login
python-telegram-bot>=21.0
apscheduler>=3.10
sqlalchemy>=2.0
python-dotenv>=1.0
requests>=2.31
websocket-client>=1.8
nsepython>=2.0               # NSE live quotes, indices
```

---

## Phase 2 — Full Intelligence Engine + Options Ideas

**Deliverable:** Complete multi-page dashboard with all patterns, full scoring, sector rotation, MTF analysis, and options setup suggestions.

### 2.1 Remaining Patterns (13 more)

All follow same `detect(candles) → PatternResult` interface:

**Candlestick:** Shooting Star, Evening Star  
**Chart:** Double Bottom, Double Top, Bull Flag, Symmetrical Triangle, Cup & Handle  
**Indicator:** RSI Divergence, MACD Crossover, EMA Crossover (9/21 and 20/50), Bollinger Squeeze  
**Breakout:** ATH Breakout, 52-Week High Breakout, Consolidation Breakout

### 2.2 Full Scoring Engine

```python
# backend/scoring/scorer.py
def score(pattern_quality, volume_ratio, trend_alignment, relative_strength, sector_strength) -> int:
    return int(
        pattern_quality    * 0.25 +
        volume_score       * 0.20 +
        trend_alignment    * 0.20 +  # MTF alignment
        relative_strength  * 0.20 +
        sector_strength    * 0.15
    )
```

### 2.3 Multi-Timeframe Analysis

For each detected signal, compute trend direction on 5m, 15m, 1H, Daily, Weekly. Count aligned timeframes → bonus multiplier on confidence score. All 4+ aligned → "High Confluence" tag shown in dashboard.

### 2.4 Sector Rotation Engine

- Computes sector momentum score = average (1D change% × volume ratio) for all stocks in sector
- Classifies sectors: Strong / Improving / Weakening / Weak
- Updates every 1H
- Feeds into scoring engine (sector_strength factor)

### 2.5 Relative Strength Engine

- RS score = stock return / NIFTY 500 return over rolling 20/60 day window
- Stocks with RS > 1.2 tagged as "Market Leaders"
- Feeds into scoring engine

### 2.6 New Dashboard Pages

- **Momentum Rankings** — Intraday / Swing / Positional tabs, ranked by scoring engine
- **Breakout Detection** — ATH, 52W, consolidation, volume breakouts with level + retest status
- **VWAP & Intraday** — Live intraday signals, gap-up tracker, ORB live status
- **Sector Rotation** — Sector classification cards + top 3 stocks per sector
- **Relative Strength** — Market leaders vs laggards table
- **Volume Analysis** — Unusual volume alerts, accumulation/distribution signals
- **Watchlist** — Add/remove stocks, per-stock alert toggle, notes
- **Stock Detail** — Click any symbol to see chart (Plotly candlestick), active patterns, MTF table, momentum score, support/resistance levels

### 2.7 Options Trade Ideas Page

Requires Angel One options chain API.

**Logic:**
1. Take top 15 signals with confidence ≥ 75 from F&O stocks
2. Fetch live options chain for each symbol from Angel One
3. Select strike: ATM for high-confidence, slight OTM (1–2 strikes) for breakout setups
4. Compute entry/target/SL using fixed RR rules:
   - Entry: current premium ± 5% (range)
   - Target: entry × 2.0 (1:2 RR)
   - Stop loss: entry × 0.5
5. Recommend expiry: nearest weekly if OI > 5000, else nearest monthly

**Table columns:** Symbol | Direction | Strike | Expiry | Entry Range | Target | SL | Underlying Setup | Confidence

**Disclaimer shown on page:** "These are rule-based setup ideas, not financial advice. Trade at your own risk."

---

## Phase 3 — Analytics, Backtesting & Production

**Deliverable:** Battle-tested system running on VPS 24/7, with historical performance analytics and PostgreSQL.

### 3.1 Backtesting Engine

- Stored historical signals from Phase 1/2 become backtest dataset
- For each pattern: compute outcome at +1 day, +3 days, +5 days after signal
- Metrics: win rate, average RR, max drawdown, profitability per pattern
- Dashboard page shows per-pattern stats table + equity curve chart

### 3.2 PostgreSQL Migration

- Schema identical to SQLite, migrated via SQLAlchemy (just swap connection string in `.env`)
- APScheduler jobs and all queries require zero changes (SQLAlchemy abstraction)

### 3.3 Market Breadth Page

- Advancing vs declining stocks (live during market hours)
- New highs / new lows count (daily)
- Above/below 200 DMA ratio

### 3.4 Heatmaps

- Sector heatmap: colour tiles by sector momentum score
- Stock heatmap: top 100 stocks colour-coded by 1D change%

### 3.5 VPS Deployment

- Ubuntu 22.04 on DigitalOcean / Hetzner (~₹500–800/month)
- `systemd` service for `main.py` (auto-restart on crash)
- Streamlit served behind Nginx reverse proxy
- Optional: password-protect dashboard with Streamlit auth

### 3.6 Celery + Redis (Optional)

- Replace APScheduler with Celery workers + Redis broker if scan times exceed 30s for full NIFTY 500
- Only needed if performance becomes a bottleneck — not built unless required

---

## Key Engineering Rules

1. **No live scan on button click** — dashboard always reads from DB
2. **No secrets in code** — `.env` only, loaded via `python-dotenv`
3. **Market hours guard on all live-data jobs** — `utils/time_utils.py`
4. **Angel One token refresh** — handle daily token expiry automatically, log failures, fall back to yfinance
5. **Graceful degradation** — if Angel One is down, yfinance takes over; if both fail, dashboard shows last stored data with "data delayed" warning
6. **Windows TA-Lib** — use `pandas-ta` as primary; `TA-Lib` optional (precompiled `.whl` needed on Windows)
7. **IST throughout** — all timestamps stored and displayed in IST (UTC+5:30)
8. **One pattern per file** — never combine pattern logic; each file is independently testable
9. **Confidence threshold for alerts: 70** — configurable in `.env` as `ALERT_MIN_CONFIDENCE`

---

## Open Items / Decisions Deferred

- F&O lot sizes and margin data — fetch from Angel One instruments file at startup
- Support/resistance calculation method — pivot points vs swing high/low (decide in Phase 2)
- Streamlit authentication for Phase 3 VPS deployment — built-in Streamlit auth vs simple password page

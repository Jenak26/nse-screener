# TraDad — Stock Market Intelligence Dashboard

## Project Purpose

A professional-grade market scanner and pattern detection dashboard for Indian equity markets (NSE), built for a swing/intraday trader. The goal is to answer **"What are the best setups in the market RIGHT NOW?"** within 1–5 seconds — without manually scanning charts for hours.

This is NOT a prediction system. It finds high-probability setups automatically.

---

## Target User

A retail trader (father) who trades NSE stocks across intraday, swing, and positional timeframes. Needs a fast, reliable tool that replaces manual chart scanning.

---

## Core Architecture

```
Market APIs
    ↓
Data Fetcher (background, scheduled)
    ↓
OHLC Candle Store (SQLite → PostgreSQL)
    ↓
Pattern Detection Engine
    ↓
Scoring Engine
    ↓
Sector Strength Engine
    ↓
Signal Database
    ↓
Streamlit Dashboard (reads DB, never scans live)
    ↓
Telegram Alerts
```

**Critical rule:** Background workers scan continuously (1m / 5m / 15m intervals). The UI only reads stored results — never triggers live scans on button clicks.

---

## Tech Stack

| Layer | Tool | Reason |
|---|---|---|
| Backend | Python 3.12+ | Best for trading/data/ML |
| Dashboard | Streamlit | Fast, professional, real-time refresh |
| Charts | Plotly | Interactive, professional |
| DB (Phase 1) | SQLite | Zero setup, local |
| DB (Phase 2) | PostgreSQL | Production-grade |
| Scheduler | APScheduler → Celery+Redis | Background scan jobs |
| Technical Analysis | pandas-ta, TA-Lib | Indicators + patterns |
| Alerts | python-telegram-bot | Telegram push alerts |
| Hosting (Phase 1) | Local PC | Free |
| Hosting (Phase 2) | VPS (DigitalOcean / Hetzner) | ~₹500–1500/month |

---

## Data Sources

| Phase | Source | Cost |
|---|---|---|
| 1 | yfinance (historical), nsepython (live NSE), jugaad-data | Free |
| 1+ | Angel One SmartAPI (real-time WebSocket) | Free with demat account |
| 2 | Zerodha Kite Connect | ~₹2000/month |

---

## Database Schema

```
stocks          — symbol, company_name, sector, market_cap, is_fno
candles         — symbol, timeframe, timestamp, open, high, low, close, volume
detected_patterns — symbol, timeframe, pattern_name, confidence_score, trend_direction, volume_confirmation, detected_at
sector_strength — sector, strength_score, momentum_score, updated_at
alerts          — symbol, alert_type, message, sent_at
watchlists      — name, symbol, notes, tags
```

---

## Pattern Detection

Each pattern is a separate module returning:
```python
{"pattern_detected": bool, "confidence": int, "direction": str, "metadata": dict}
```

**Candlestick:** Hammer, Bullish Engulfing, Morning Star, Shooting Star, Doji  
**Chart:** Double Bottom, Double Top, Flags, Triangles, Cup & Handle  
**Momentum:** ORB, VWAP Bounce, Gap Up, Volume Breakout  
**Indicator:** RSI Divergence, MACD Crossover, EMA Crossover, Bollinger Squeeze  
**Breakout:** ATH, 52-Week High, Consolidation Breakout

---

## Scoring Engine

| Factor | Weight |
|---|---|
| Pattern quality | 25% |
| Volume confirmation | 20% |
| Trend alignment (MTF) | 20% |
| Relative strength | 20% |
| Sector strength | 15% |

Score: 0–100. Higher = stronger setup.

---

## Multi-Timeframe Analysis

Supported: 5m, 15m, 1H, Daily, Weekly  
Higher confidence assigned when signal aligns across multiple timeframes.

---

## Dashboard Pages

1. **Home** — Market overview (NIFTY/BANKNIFTY/FINNIFTY), top momentum stocks, sector strength panel, live alerts feed
2. **Pattern Scanner** — Click pattern → see all matching stocks instantly (table with confidence, TF, volume, trend)
3. **Multi-TF Analysis** — Per-stock signal across all timeframes
4. **Momentum Rankings** — Relative strength rankings (Intraday / Swing / Positional tabs)
5. **Breakout Detection** — ATH, 52W, consolidation, volume breakouts
6. **VWAP & Intraday** — ORB, VWAP bounce, gap-up momentum
7. **Sector Rotation** — Strongest/weakest sectors, capital flow
8. **Relative Strength** — Stocks outperforming NIFTY/sector
9. **Volume Analysis** — Unusual volume, accumulation/distribution
10. **Watchlist** — Custom watchlists with alerts and notes
11. **Stock Detail** — Chart, indicators, active patterns, momentum score, S/R levels
12. **Backtesting** — Historical pattern win rates, RR stats

---

## Project Folder Structure

```
tradad/
├── app/                    # Streamlit pages
│   ├── dashboard/
│   ├── charts/
│   ├── tables/
│   └── filters/
├── backend/
│   ├── data_fetcher/       # API clients
│   ├── websocket/          # Real-time feed
│   ├── scanners/           # Background scan jobs
│   ├── patterns/           # One module per pattern
│   ├── indicators/         # Technical indicators
│   ├── scoring/            # Confidence scoring
│   ├── alerts/             # Telegram bot
│   ├── sectors/            # Sector strength engine
│   └── rankings/           # Momentum rankings
├── database/
│   ├── models/
│   ├── migrations/
│   └── queries/
├── config/                 # Settings, API keys (env-based)
├── logs/
├── tests/
├── utils/
├── main.py                 # Entry point
└── requirements.txt
```

---

## Key Constraints

- **Windows development** (dev machine is Windows 11) — TA-Lib needs precompiled wheel on Windows
- **Student budget** — Phase 1 must be ₹0/month
- **API keys in environment variables** — never hardcoded
- **No live scanning on button click** — always read from DB
- **Target response time:** < 5 seconds for any dashboard page

---

## Phase Overview

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation: data pipeline, core patterns, basic dashboard, Telegram alerts | Planning |
| 2 | Full pattern library, scoring engine, sector rotation, MTF analysis | Planned |
| 3 | Backtesting, advanced analytics, PostgreSQL, VPS deployment | Planned |

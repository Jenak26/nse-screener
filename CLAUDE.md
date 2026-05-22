# NSE Stock Screener

## Project Purpose

A fast, clean stock screener for NIFTY 500 stocks filtered by real fundamentals — P/E, ROE, Debt/Equity, Revenue Growth, Promoter Holding. Positioned as a better-designed, faster alternative to Screener.in. Built as a resume project targeting FAANG and finance companies (Google, Meta, Amazon, JP Morgan, Goldman Sachs, BlackRock).

**The differentiator:** Pre-computed daily pipeline means sub-second filter response. Clean React UI vs. the cluttered UX of existing tools.

---

## Core Architecture

```
NIFTY 500 list (data/nifty500.csv)
        ↓
Pipeline (daily at 6:30 AM IST via APScheduler)
  ├── yfinance → P/E, Market Cap, ROE, D/E, Revenue Growth
  └── NSE shareholding CSV → Promoter Holding %
        ↓
SQLite DB (stocks table, 500 rows, refreshed daily)
        ↓
FastAPI (Railway) — reads DB only, never fetches live on request
        ↓
React + Vite (Vercel) — TanStack Table + TanStack Query
```

**Critical rule:** The pipeline pre-computes everything. The API never calls yfinance on a user request. All filtering happens via SQL WHERE clauses, not Python loops.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS |
| Table | TanStack Table v8 |
| Data fetching | TanStack Query v5 |
| Charts (Phase 2) | Recharts |
| Backend | FastAPI + Python 3.12 |
| ORM | SQLAlchemy 2 |
| DB Phase 1 | SQLite |
| DB Phase 2 | PostgreSQL (Railway) |
| Scheduler | APScheduler 3 |
| Data source | yfinance + NSE public CSVs |
| Deployment | Vercel (frontend) + Railway (backend) |

---

## Database Schema

```
stocks         — symbol, company_name, sector, market_cap, pe_ratio, roe,
                 debt_to_equity, revenue_growth_yoy, promoter_holding,
                 current_ratio, price, fifty_two_week_high, updated_at

metric_history — symbol, metric, value, quarter, recorded_at  (Phase 2)
```

---

## API Endpoints

```
GET /api/stocks          — filtered, sorted, paginated
GET /api/stocks/{symbol} — detail + sector rank percentiles
GET /api/sectors         — sector averages
GET /api/meta            — last_updated, total_stocks, pipeline_status
```

---

## Folder Structure

```
nse-screener/
├── frontend/
│   └── src/
│       ├── components/     FilterPanel, StockTable, StockDetailModal
│       ├── hooks/          useStocks.ts
│       ├── lib/            api.ts
│       ├── types/          stock.ts
│       └── App.tsx
├── backend/
│   ├── api/
│   │   ├── main.py
│   │   ├── routes/         stocks.py, sectors.py
│   │   └── schemas.py
│   ├── pipeline/
│   │   ├── fetcher.py      yfinance bulk fetch
│   │   ├── nse_holdings.py NSE shareholding CSV parser
│   │   └── scheduler.py    APScheduler daily job
│   └── database/
│       ├── models.py
│       ├── db.py
│       └── queries.py      SQL filter/sort query builder
├── data/
│   └── nifty500.csv
└── tests/
```

---

## Phase Overview

| Phase | Scope | Status |
|---|---|---|
| 1 | Pipeline + FastAPI + React UI + Live deployment | Planning |
| 2 | Sector view, presets, sparklines, PostgreSQL, demo GIF | Planned |

**Design spec:** `docs/superpowers/specs/2026-05-22-nse-screener-design.md`

---

## Key Constraints

- **Windows development** (Windows 11) — no TA-Lib, no Linux-only dependencies
- **Free tier deployment** — Railway 512MB RAM limit; pipeline batches yfinance calls (10 symbols, 1s delay)
- **No auth** — public read-only tool
- **No live scanning on request** — API reads DB only
- **Target response time:** < 500ms for any filter query

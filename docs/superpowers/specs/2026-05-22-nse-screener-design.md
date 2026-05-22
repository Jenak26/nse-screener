# NSE Stock Screener — Design Spec
**Date:** 2026-05-22
**Status:** Approved
**Approach:** Option A — React + FastAPI + Background Pipeline, 2 phases

---

## Project Summary

A fast, clean NSE stock screener for NIFTY 500 stocks filtered by real fundamentals — P/E, ROE, Debt/Equity, Revenue Growth, Promoter Holding. Positioned as a better-designed, faster alternative to Screener.in. Built for resume targeting FAANG and finance companies (Google, Meta, Amazon, JP Morgan, Goldman Sachs, BlackRock).

**Core principle:** A daily background pipeline pre-computes all fundamentals. The API serves cached data only — no live yfinance calls on request. Sub-second filter response at any time.

**Stock universe:** NIFTY 500 (existing `data/nifty500.csv`)

**Data sources:** yfinance (P/E, ROE, D/E, Revenue, Market Cap) + NSE public shareholding CSVs (Promoter Holding %)

**Deployment:** React on Vercel (free) + FastAPI on Railway (free tier, permanent URL)

**Auth:** None — public read-only tool

---

## Architecture

```
NIFTY 500 list (data/nifty500.csv)
        ↓
Pipeline (daily at 6:30 AM IST via APScheduler)
  ├── yfinance.Ticker(symbol).info → P/E, Market Cap, ROE, D/E, Revenue
  └── NSE shareholding CSV (public URL) → Promoter Holding %
        ↓
SQLite DB → stocks table (500 rows, refreshed daily)
        ↓
FastAPI (Railway)
  ├── GET /api/stocks   → paginated, filtered via SQL WHERE clauses
  ├── GET /api/stocks/{symbol}
  ├── GET /api/sectors
  └── GET /api/meta
        ↓
React + Vite (Vercel) — TanStack Query fetches on filter change
  ├── FilterPanel  — sliders + dropdowns, debounced 300ms
  ├── StockTable   — TanStack Table, sortable columns, 20/page
  └── StockDetailModal — row click, all metrics + sector rank
```

---

## Two-Phase Scope

### Phase 1 — Core Screener (ship-ready)

**Goal:** A live, usable screener at a public URL. Every metric works. Filter + sort + detail view all functional.

**Deliverables:**
- Daily pipeline fetching all 500 stocks (yfinance + NSE CSV)
- FastAPI with `/api/stocks`, `/api/sectors`, `/api/meta`
- React UI: FilterPanel, StockTable, StockDetailModal
- Deployed: Vercel frontend + Railway backend
- `.env.example`, clean `README.md` with live URL

**Metrics:** P/E ratio, Market Cap (₹ Cr), ROE (%), Debt/Equity, Revenue Growth YoY (%), Promoter Holding (%), Sector, Last Close Price, 52-Week High

### Phase 2 — Depth

**Goal:** Differentiate from Screener.in. Show depth of engineering and product thinking.

**Deliverables:**
- Sector comparison view (avg P/E, ROE, stock count per sector)
- Screener presets saved to localStorage ("High ROE + Low Debt", "Growth Stocks")
- Historical metric sparklines (ROE/PE over 4 quarters) — requires `metric_history` table
- PostgreSQL migration (Railway managed DB)
- README demo GIF

---

## Folder Structure

```
nse-screener/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── FilterPanel.tsx
│   │   │   ├── StockTable.tsx
│   │   │   └── StockDetailModal.tsx
│   │   ├── hooks/
│   │   │   └── useStocks.ts
│   │   ├── lib/
│   │   │   └── api.ts
│   │   ├── types/
│   │   │   └── stock.ts
│   │   └── App.tsx
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── backend/
│   ├── api/
│   │   ├── main.py             ← FastAPI app, CORS, APScheduler startup
│   │   ├── routes/
│   │   │   ├── stocks.py       ← /api/stocks, /api/stocks/{symbol}
│   │   │   └── sectors.py      ← /api/sectors, /api/meta
│   │   └── schemas.py          ← Pydantic response models
│   ├── pipeline/
│   │   ├── fetcher.py          ← yfinance bulk fetch for 500 symbols
│   │   ├── nse_holdings.py     ← NSE shareholding CSV download + parse
│   │   └── scheduler.py        ← APScheduler daily job wiring
│   └── database/
│       ├── models.py           ← SQLAlchemy Stock model (adapted from existing)
│       ├── db.py               ← engine + session factory (reused from existing)
│       └── queries.py          ← filter/sort query builder
├── data/
│   └── nifty500.csv            ← existing, kept as-is
├── tests/
│   ├── test_pipeline.py
│   ├── test_api.py
│   └── test_queries.py
├── .env.example
├── railway.toml                ← Railway deploy config
├── vercel.json                 ← Vercel frontend config
└── README.md
```

**Removed from existing project:** `app/` (Streamlit), `backend/patterns/`, `backend/scanners/`, `backend/scoring/`, `backend/sectors/`, `backend/alerts/`, `backend/rankings/`, `backend/backtesting/`

**Reused:** `data/nifty500.csv`, `database/db.py` (minor edits), `database/models.py` (rewritten for new schema)

---

## Database Schema

### Phase 1

```sql
stocks
  symbol              TEXT PRIMARY KEY   -- "RELIANCE.NS" (yfinance format)
  company_name        TEXT
  sector              TEXT
  market_cap          REAL               -- ₹ crores
  pe_ratio            REAL
  roe                 REAL               -- % (return on equity)
  debt_to_equity      REAL
  revenue_growth_yoy  REAL               -- % year-over-year
  promoter_holding    REAL               -- % from NSE shareholding CSV
  current_ratio       REAL
  price               REAL               -- last close
  fifty_two_week_high REAL
  updated_at          TIMESTAMP
```

### Phase 2 addition

```sql
metric_history
  id          INTEGER PRIMARY KEY
  symbol      TEXT REFERENCES stocks(symbol)
  metric      TEXT     -- "roe", "pe_ratio", "revenue_growth_yoy"
  value       REAL
  quarter     TEXT     -- "Q4FY25"
  recorded_at TIMESTAMP
```

---

## API Contract

```
GET /api/stocks
  Query params (all optional):
    sector              TEXT
    pe_min, pe_max      REAL
    roe_min             REAL
    debt_max            REAL
    revenue_growth_min  REAL
    promoter_min        REAL
    sort_by             TEXT  (default: market_cap)
    sort_dir            TEXT  (asc | desc)
    page                INT   (default: 1)
    page_size           INT   (default: 20, max: 100)
  Response: { stocks: Stock[], total: int, last_updated: str }

GET /api/stocks/{symbol}
  Response: Stock + sector_rank { pe_percentile, roe_percentile, ... }

GET /api/sectors
  Response: [{ sector, avg_pe, avg_roe, avg_debt_to_equity, stock_count }]

GET /api/meta
  Response: { last_updated: str, total_stocks: int, pipeline_status: "ok" | "stale" }
```

---

## Tech Stack

| Layer | Tool | Version |
|---|---|---|
| Frontend framework | React + Vite | React 18, Vite 5 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.x |
| Table | TanStack Table | v8 |
| Data fetching | TanStack Query | v5 |
| Charts (Phase 2) | Recharts | 2.x |
| Backend | FastAPI | 0.111+ |
| Python | 3.12 | — |
| ORM | SQLAlchemy | 2.x |
| DB Phase 1 | SQLite | — |
| DB Phase 2 | PostgreSQL | Railway managed |
| Scheduler | APScheduler | 3.x |
| Data source | yfinance | latest |
| Deployment | Vercel + Railway | free tier |

---

## Key Constraints

- **No live data fetch on API request** — pipeline runs daily, API reads DB only
- **All filtering at SQL level** — `WHERE` clauses in `queries.py`, not Python loops
- **Free tier deployment** — Railway free tier: 512MB RAM, sufficient for 500-stock pipeline
- **Windows dev machine** — no TA-Lib dependency in Phase 1 or 2 (not needed)
- **yfinance rate limits** — pipeline fetches with 1s delay between batches of 10 symbols
- **NSE shareholding CSV** — quarterly archive at `https://archives.nseindia.com/corporate/shp<MonYYYY>.zip`; `nse_holdings.py` resolves the latest available quarter URL at pipeline run time
- **Symbol format** — `nifty500.csv` has bare symbols (e.g. `RELIANCE`); fetcher appends `.NS` before calling yfinance (e.g. `RELIANCE.NS`)
- **Repo restructure** — existing `TraDad/` repo is restructured in-place: old Streamlit/pattern code removed, new `frontend/` and updated `backend/` added. Repo can be renamed to `nse-screener` on GitHub for the resume link.

---

## What "Done" Looks Like Per Phase

**Phase 1 done:** Live URL works. Filter by any combination of metrics. Table sorts. Clicking a row opens detail. `last_updated` shows today's date. README has the live URL.

**Phase 2 done:** Sector view works. Preset save/load works. Sparklines show 4 quarters of data. PostgreSQL is the live DB. README has a demo GIF.

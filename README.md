# NSE Stock Screener

A fast, clean stock screener for India's top 500 listed companies (NIFTY 500). Filter by real fundamentals — P/E ratio, ROE, debt levels, revenue growth, and promoter holding — and get results in under 500ms.

**Live app → [nse-screener-ajdhzrw2s-janak-kabras-projects.vercel.app](https://nse-screener-ajdhzrw2s-janak-kabras-projects.vercel.app)** — data updates automatically every morning at 6:30 AM IST

![NSE Screener demo](docs/demo.gif)

---

## Why I built this

Every retail investor in India has used Screener.in at some point. It's the go-to tool for fundamental analysis, but it has some real pain points — the UI is dense and ad-heavy, complex filter combinations can be slow, and there's no quick way to compare sectors side by side.

I wanted to build something faster and cleaner. The core idea was simple: **pre-compute everything**. Instead of hitting yfinance on every user request (which would take 30+ seconds), a background pipeline runs at 6:30 AM IST every day, fetches data for all 500 stocks, and stores it in a database. Every API call just reads from that database — sub-second, always.

---

## What it does

**Stock Screener tab**
- Table of all NIFTY 500 stocks with price, sector, P/E, ROE, D/E, revenue growth, and promoter holding
- Filter panel on the left — narrow down by any combination of metrics
- One-click preset screens: High ROE, Low Debt, Growth Stocks, Value Picks, Strong Promoters
- Save your own custom filter combinations to browser storage
- Click any row to open a detail modal with sector percentile rankings (e.g. "This stock's ROE is better than 84% of its sector peers") and historical trend sparklines

**Sector Overview tab**
- All NIFTY 500 sectors ranked by average P/E, ROE, and Debt/Equity
- Visual bar charts so you can instantly see which sectors are high-quality vs overleveraged

---

## Architecture

The most important design decision in this project is the separation between the **pipeline** and the **API**.

```
NIFTY 500 symbols (data/nifty500.csv)
        │
        ▼
Daily Pipeline — runs at 6:30 AM IST via APScheduler
├── yfinance (batched, 10 symbols at a time, 1s delay)
│   └── P/E, ROE, D/E, Revenue Growth, Market Cap, Price, 52W High
└── NSE shareholding CSV archives
    └── Promoter Holding %
        │
        ▼
PostgreSQL (Railway)
  ├── stocks table — 500 rows, refreshed daily
  └── metric_history table — quarterly snapshots for sparklines
        │
        ▼
FastAPI (Railway) — reads DB only, never calls yfinance on a user request
        │
        ▼
React + Vite (Vercel) — TanStack Table + TanStack Query
```

**Why this matters:** Any filter query — no matter how complex — is a single SQL SELECT with WHERE clauses. The database has 500 rows. Response time is always under 500ms.

---

## Tech stack

### Backend
| Tool | Why |
|---|---|
| **FastAPI** | Auto OpenAPI docs, Pydantic validation built-in, async-native, fastest Python framework |
| **SQLAlchemy 2** | Type-safe ORM with composable query builder — filters chain as `.where()` clauses, never Python-level loops |
| **APScheduler** | Lightweight async scheduler — runs inside the FastAPI process, no separate worker needed |
| **yfinance** | Unofficial but free Yahoo Finance scraper — right call for a personal project |
| **pydantic-settings** | Environment variables as typed Python objects — autocomplete, no `os.getenv()` strings scattered around |
| **pytest + httpx** | 23 tests with a real in-memory SQLite database — no mocks, no lies |

### Frontend
| Tool | Why |
|---|---|
| **React 18 + TypeScript** | Industry standard; strict types catch bugs at compile time |
| **Vite** | 10x faster dev server than CRA, instant HMR |
| **TanStack Table v8** | Headless — I control all the HTML/CSS. Server-side sort and pagination built into the state model |
| **TanStack Query v5** | Caching + background refetch + `placeholderData` to prevent table flashing on sort/page change |
| **Tailwind CSS** | Utility-first — no context switching between files, easy to maintain |
| **Recharts** | Lightweight charting for sparklines in the detail modal |

### Infrastructure
| | |
|---|---|
| **Railway** | Backend + PostgreSQL in one project. Nixpacks auto-detects Python — no Dockerfile needed |
| **Vercel** | Best-in-class Vite support. Auto preview deployments on every push |
| **PostgreSQL** | Production database — Railway managed, zero ops |
| **SQLite** | Local development — same SQLAlchemy models, just a different `DATABASE_URL` |

---

## Features

- **Sub-500ms filter response** on any combination of metrics across 500 stocks
- **7 filter dimensions** — Sector, P/E (min/max), ROE, Debt/Equity, Revenue Growth, Promoter Holding
- **Server-side sort + pagination** — TanStack Table tells the API what to fetch, not the other way around
- **Sector percentile rankings** — see where a stock stands relative to its sector peers on every metric
- **Historical sparklines** — 4-quarter ROE and P/E trend charts in the stock detail modal
- **Preset screens** — 5 built-in screens + save your own to localStorage
- **Sector Overview** — compare all sectors on avg ROE, P/E, D/E with proportional bar charts
- **Auto-refresh** — pipeline runs daily, frontend polls meta endpoint every 60s for last-updated timestamp
- **Zero live scraping on request** — all data is pre-computed, API is read-only

---

## Data sources

| Metric | Source | Notes |
|---|---|---|
| P/E Ratio | yfinance | Trailing twelve months |
| ROE | yfinance | Return on equity % |
| Debt / Equity | yfinance | Total debt / total equity |
| Revenue Growth YoY | yfinance | Quarterly financials comparison |
| Market Cap | yfinance | In crores (INR) |
| Last Close Price | yfinance | Previous trading day close |
| 52-Week High | yfinance | Rolling 52-week maximum |
| Promoter Holding | NSE shareholding CSV | Official quarterly NSE disclosure |

The promoter holding data comes from NSE's public shareholding pattern archives — not yfinance — because yfinance's institutional data is sourced from SEC filings and is unreliable for Indian stocks. NSE's CSV archives are the authoritative source.

---

## Running locally

**Prerequisites:** Python 3.12+, Node.js 18+

```bash
# 1. Clone and install backend dependencies
git clone https://github.com/Jenak26/nse-screener.git
cd nse-screener
pip install -r requirements.txt

# 2. Set up environment
cp .env.example .env
# .env already has SQLite configured for local dev — no changes needed

# 3. Start the backend
uvicorn backend.api.main:app --reload --port 8000

# 4. Seed initial data (takes ~15 minutes for all 500 stocks)
curl -X POST http://localhost:8000/api/admin/run-pipeline

# 5. Install and start the frontend (new terminal)
cd frontend
cp .env.example .env        # sets VITE_API_URL=http://localhost:8000
npm install
npm run dev
```

Open **http://localhost:5173**. The table will be empty until the pipeline finishes in the background.

---

## Project structure

```
nse-screener/
├── backend/
│   ├── api/
│   │   ├── main.py              # FastAPI app, lifespan, CORS, scheduler
│   │   ├── schemas.py           # Pydantic request/response models
│   │   └── routes/
│   │       ├── stocks.py        # GET /stocks, GET /stocks/{symbol}
│   │       └── sectors.py       # GET /sectors, GET /meta
│   ├── database/
│   │   ├── models.py            # SQLAlchemy models: Stock, MetricHistory
│   │   ├── db.py                # Engine, session factory, init_db()
│   │   └── queries.py           # Filter/sort query builder, percentiles, history
│   ├── pipeline/
│   │   ├── fetcher.py           # yfinance bulk fetch with batching + error handling
│   │   ├── nse_holdings.py      # NSE shareholding CSV parser
│   │   └── scheduler.py         # APScheduler job + MetricHistory snapshots
│   └── config/
│       └── settings.py          # pydantic-settings env config
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── FilterPanel.tsx  # Left sidebar filters
│       │   ├── StockTable.tsx   # TanStack Table data grid
│       │   ├── StockDetailModal.tsx  # Per-stock metrics + sparklines
│       │   ├── SectorView.tsx   # Sector comparison table
│       │   ├── PresetBar.tsx    # Built-in + custom filter presets
│       │   └── Sparkline.tsx    # Recharts line chart component
│       ├── hooks/
│       │   └── useStocks.ts     # TanStack Query hooks
│       ├── lib/
│       │   └── api.ts           # Typed API client
│       ├── types/
│       │   └── stock.ts         # TypeScript interfaces
│       └── App.tsx              # Root component, tab state
├── data/
│   └── nifty500.csv             # 500 NSE symbols + company names
├── tests/
│   ├── conftest.py              # Test DB fixture
│   ├── test_api.py              # API endpoint tests
│   └── test_queries.py          # Query builder tests
├── railway.toml                 # Railway deploy config
└── requirements.txt
```

---

## Deploying your own

**Backend on Railway:**
1. Fork this repo
2. New Railway project → Deploy from GitHub → select your fork
3. Add a PostgreSQL plugin to the project
4. Set these environment variables on the backend service:
   - `DATABASE_URL` → copy from the PostgreSQL plugin's Connect tab
   - `CORS_ORIGINS` → `http://localhost:5173,https://your-app.vercel.app`
   - `STOCK_UNIVERSE_PATH` → `data/nifty500.csv`
5. Generate a domain (Settings → Networking)
6. Hit `POST /api/admin/run-pipeline` once to seed data

**Frontend on Vercel:**
1. New Vercel project → import your fork
2. Set Root Directory to `frontend`
3. Add environment variable: `VITE_API_URL` → your Railway URL
4. Deploy

---

## API reference

```
GET  /api/stocks                   Filter, sort, paginate stocks
GET  /api/stocks/{symbol}          Stock detail + sector rank percentiles + metric history
GET  /api/sectors                  Sector averages (P/E, ROE, D/E, stock count)
GET  /api/meta                     Last pipeline run, total stocks, pipeline status
POST /api/admin/run-pipeline       Manually trigger the pipeline (seeding / testing)
```

**Filter parameters for `/api/stocks`:**
```
sector, pe_min, pe_max, roe_min, debt_max, revenue_growth_min, promoter_min
sort_by, sort_dir (asc/desc), page, page_size
```

---

## Tests

```bash
pytest tests/ -v
```

23 tests covering API endpoints, query builder (filters, sorting, pagination), sector stats, and percentile calculations. Uses an in-memory SQLite test database — no mocking of database calls.

---

## What's next (Phase 3 ideas)

- **Backtesting** — given a filter screen, show what returns those stocks delivered historically
- **Daily price history** — store OHLCV data to power proper technical analysis
- **Email/Telegram alerts** — notify when a stock enters a saved screen
- **Market breadth** — advance/decline ratio, % of stocks above 200 DMA
- **Heatmap** — sector × metric visual grid

---

## License

MIT — do whatever you want with this.

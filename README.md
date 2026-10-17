# 🚀 NSE Stock Screener

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white)](https://www.sqlalchemy.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

A high-performance, visually stunning fundamental stock screener for India's NIFTY 500 stocks. Filter, sort, and analyze the market in real time: every filter query is served in ~3 ms (p50, server-side). Positioned as a modern, clean, and ad-free alternative to Screener.in.

**Live Application → [nse-screener-rose.vercel.app](https://nse-screener-rose.vercel.app)**  
*Data updates automatically every morning at 6:30 AM IST.*

---

## 💡 Why I Built This

Every retail investor in India has used Screener.in at some point. It's the go-to tool for fundamental analysis, but it has some real pain points — the UI is dense and ad-heavy, complex filter combinations can be slow, and there's no quick way to compare sectors side by side.

I wanted to build something faster and cleaner. The core idea was simple: **pre-compute everything**. Instead of hitting `yfinance` on every user request (which would take 30+ seconds), a background pipeline runs at 6:30 AM IST every day, fetches data for all 500 stocks, and stores it in a database. Every API call just reads from that database — sub-second, always.

---

## ⚙️ Core Architecture

The most important design decision in this project is the strict separation between the **pipeline** and the **API**.

```mermaid
flowchart TD
    A["NIFTY 500 Stocks List (data/nifty500.csv)"] --> B("Daily Pipeline (GitHub Action, 6:30 AM IST)")
    B --> C1("yfinance API (Batched calls, 1s delay)")
    C1 -->|P/E, Market Cap, ROE, D/E, Revenue Growth, Promoter/Insider %| S["Committed snapshot (data/seed_*.csv)"]
    S -->|push triggers redeploy| D[("SQLite (or PostgreSQL via DATABASE_URL)")]
    D --> E("FastAPI Backend (Render)")
    E --> F("React Frontend (Vercel, /api proxied to backend)")
    F --> F1("TanStack Table v8 (Data Grid)")
    F --> F2("TanStack Query v5 (Caching)")
    F --> F3("Recharts (Sparklines)")
    
    classDef default fill:#1f2937,stroke:#374151,color:#f3f4f6;
    classDef highlight fill:#0284c7,stroke:#0369a1,color:#fff;
    class E,F highlight;
```

> [!IMPORTANT]
> **One round-trip per request:** any filter combination compiles into a single SQL `SELECT` with chained `WHERE` clauses, and the total match count rides along as a `COUNT(*) OVER ()` window column, so filtering, counting and pagination never take a second query. Indexes cover the sector filter, the default market-cap sort and the history lookup. Measured locally over 100 requests per endpoint: **p50 ≈ 2–3 ms, p95 < 7 ms** server-side.

> **Data freshness on free hosting:** Render's free tier wipes the disk on every restart. Instead of refetching 500 tickers on each boot, a daily GitHub Action runs the pipeline and commits `data/seed_stocks.csv` + `data/seed_history.csv`; the push redeploys the API, which seeds itself from that snapshot in under a second. A run that comes back mostly empty (Yahoo throttling) never overwrites good data.

---

## ✨ Features

### 📊 Stock Screener Tab
* **Glassmorphic Filter Panel**: Slide filters seamlessly to narrow down stocks by P/E, ROE, Debt/Equity, YoY Revenue Growth, and Promoter Holding.
* **One-Click Presets**: Pre-configured filters for *High ROE*, *Low Debt*, *Growth Stocks*, *Value Picks*, and *Strong Promoters*.
* **Custom Presets**: Create, edit, and save your own filter combinations directly to browser local storage.
* **TanStack Data Grid**: Features fluid server-side sorting, pagination, and columns configuration.

### 📈 Stock Detail Modal
* **Sector Percentile Rankings**: Instantly see how a stock compares to its industry peers (e.g., *"This stock's ROE is higher than 84% of its sector peers"*).
* **Historical Trend Sparklines**: Visualize quarterly ROE and P/E trends using light, interactive Recharts sparklines.

### 🌐 Sector Overview Tab
* **Industry Performance Ranking**: Compare all NIFTY 500 sectors ranked by average P/E, ROE, and Debt/Equity.
* **Proportional Charts**: Dynamic visual bar charts to instantly spot high-quality or overleveraged sectors.

---

## 🛠️ Tech Stack

### Backend
| Tool | Rationale |
|---|---|
| **FastAPI** | Auto OpenAPI/Swagger documentation, native asynchronous support, Pydantic type safety. |
| **SQLAlchemy 2** | Type-safe ORM utilizing a composable query builder (filters chain as SQL `WHERE` clauses). |
| **APScheduler** | Async scheduler running inside the FastAPI process — no extra workers or Redis required. |
| **yfinance** | Light and reliable Yahoo Finance scraper to acquire stock market data. |
| **pytest + httpx** | 36 tests against an in-memory SQLite database, including a single-round-trip assertion on the filter query. |

### Frontend
| Tool | Rationale |
|---|---|
| **React 18 + TS** | Industry-standard component framework with compile-time type safety. |
| **Vite** | Blazing-fast development build server and Hot Module Replacement (HMR). |
| **TanStack Table v8** | Headless table library enabling complete styling control with server-side sort/pagination hooks. |
| **TanStack Query v5** | Out-of-the-box caching, background synchronization, and loading transitions. |
| **Tailwind CSS** | Premium glassmorphism utility classes and responsive styling. |
| **Recharts** | Declarative charting library for rendering sparklines in the details layout. |

---

## 🖥️ Running Locally

### Prerequisites
* **Python 3.12+**
* **Node.js 18+**

### Step-by-Step Setup

1. **Clone the repository and install backend dependencies:**
   ```bash
   git clone https://github.com/Jenak26/nse-screener.git
   cd nse-screener
   pip install -r requirements.txt
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # The default .env is pre-configured for SQLite local development
   ```

3. **Start the FastAPI backend server:**
   ```bash
   uvicorn backend.api.main:app --reload --port 8000
   ```

4. **Market data loads automatically** from the committed snapshot on first start. To pull fresh data (~10 minutes for 500 stocks because of yfinance rate limits):
   ```bash
   python -m backend.pipeline.seed refresh          # updates data/seed_*.csv
   # or, against a running server (set ADMIN_TOKEN in .env first):
   curl -X POST -H "X-Admin-Token: $ADMIN_TOKEN" http://localhost:8000/api/admin/run-pipeline
   ```

5. **Install and run the React frontend:**
   *(Open a new terminal)*
   ```bash
   cd frontend
   npm install                 # Vite proxies /api to http://127.0.0.1:8000
   npm run dev
   ```

Open **http://localhost:5173** to view the application.

---

## 📁 Project Structure

```
nse-screener/
├── backend/
│   ├── api/
│   │   ├── main.py              # FastAPI application & lifecycle startup
│   │   ├── schemas.py           # Pydantic models for request/response serialization
│   │   └── routes/
│   │       ├── stocks.py        # /stocks query endpoints
│   │       └── sectors.py       # /sectors averages and analytics
│   ├── database/
│   │   ├── models.py            # SQLAlchemy Schema definition (Stock, MetricHistory)
│   │   ├── db.py                # Engine settings and Session factory
│   │   └── queries.py           # SQL filter queries, percentile ranks, history helpers
│   ├── pipeline/
│   │   ├── fetcher.py           # yfinance scraper with batching & recovery
│   │   ├── nse_holdings.py      # NSE Shareholding CSV disclosure parser (falls back to Yahoo insider %)
│   │   ├── scheduler.py         # Pipeline run, per-quarter history upsert, scheduler
│   │   └── seed.py              # Snapshot seed/export + `refresh` CLI used by the daily Action
│   └── config/
│       └── settings.py          # pydantic-settings environment variables loader
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── FilterPanel.tsx  # Dynamic sidebar filters
│       │   ├── StockTable.tsx   # TanStack Data Grid
│       │   ├── StockDetailModal.tsx  # Interactive detail modal
│       │   ├── SectorView.tsx   # Sector comparative charts
│       │   ├── PresetBar.tsx    # Saved filters quick switcher
│       │   └── Sparkline.tsx    # Recharts data-visualizer
│       ├── hooks/
│       │   └── useStocks.ts     # TanStack Query custom hooks
│       ├── lib/
│       │   └── api.ts           # fetch client (same-origin /api)
│       ├── types/
│       │   └── stock.ts         # TypeScript schema types
│       └── App.tsx              # Component orchestration and tab states
├── data/
│   ├── nifty500.csv             # Official list of 500 NIFTY symbols
│   ├── seed_stocks.csv          # Daily snapshot the API boots from
│   └── seed_history.csv         # Quarterly metric history (sparklines)
├── tests/
│   ├── conftest.py              # Pytest fixtures and mock database setup
│   ├── test_api.py              # Route testing
│   └── test_queries.py          # Database queries validation
├── .github/workflows/           # tests, daily data refresh, keep-demos-warm pinger
├── render.yaml                  # Render Blueprint (free web service)
├── railway.toml                 # Alternative: Railway deploy with PostgreSQL
└── requirements.txt             # Backend dependencies
```

---

## 🚀 Deploying to Production

### 1. Backend (Render, free)
1. Render Dashboard → **New → Blueprint** → select this repository. `render.yaml` configures everything (Python 3.12, health check, a generated `ADMIN_TOKEN`).
2. The service boots from the committed snapshot; no manual seeding needed.
3. The **Refresh data snapshot** Action keeps the data current, and **Keep demos warm** pings the API every 10 minutes during the day so visitors don't hit a cold start.

> Prefer PostgreSQL? Set `DATABASE_URL` to a Postgres connection string (e.g. Railway, using `railway.toml`). Tables and indexes are created automatically on startup.

### 2. Frontend (Vercel)
1. Import the repository on Vercel and set the root directory to `frontend`.
2. `frontend/vercel.json` proxies `/api/*` to the backend, so no environment variables or CORS setup are needed. Change the rewrite destination if your backend URL differs.

---

## 🔑 License

Distributed under the MIT License. See `LICENSE` for more information.

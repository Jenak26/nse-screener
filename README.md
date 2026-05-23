# NSE Stock Screener

Screen NIFTY 500 stocks by real fundamentals — P/E, ROE, Debt/Equity, Revenue Growth, and Promoter Holding. Fast filters, clean UI, sub-second results.

**Live demo:** _add your Vercel URL here_

![NSE Screener demo](docs/demo.gif)

## Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS 4 + TanStack Table v8 + TanStack Query v5
- **Backend:** FastAPI + SQLAlchemy 2 + APScheduler 3
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

# Frontend (separate terminal)
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`.

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
| Last Close Price | yfinance |
| 52-Week High | yfinance |

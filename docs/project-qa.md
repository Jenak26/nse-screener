# NSE Screener — Complete Interview Q&A

> Everything you need to explain this project confidently — from a 30-second intro to a 5-minute deep dive to tough technical questions.

---

## THE PITCHES

### 30-second version (elevator pitch)
> "I built a full-stack stock screener for India's top 500 listed companies — NIFTY 500. You filter by fundamentals like P/E ratio, ROE, debt levels, revenue growth, and promoter holding. The key engineering decision was pre-computing all data in a daily background pipeline so every filter query hits a database and returns in under 500ms — no live API calls during user interaction. It's live on Vercel and Railway."

### 2-minute version
> "The problem I was solving: existing tools like Screener.in are slow on complex filters and have cluttered UIs. My differentiator is architecture — I run a daily pipeline at 6:30 AM IST using APScheduler that fetches fundamentals for all 500 stocks via yfinance, parses NSE's shareholding CSVs for promoter holding data, and stores everything in PostgreSQL. The FastAPI backend only reads from the database — it never calls yfinance on a user request. That's what gives sub-500ms response on any filter combination.

> The frontend is React with TanStack Table for server-side sorting and pagination, TanStack Query for caching, and Tailwind for styling. Phase 2 added sector comparison — you can see which sectors have the best average ROE or lowest debt — plus historical sparklines showing 4-quarter trends for key metrics, and a preset bar where you can one-click apply screens like 'High ROE + Low Debt'. The whole thing is deployed — backend on Railway with PostgreSQL, frontend on Vercel."

### 5-minute deep dive (memorize this flow)

**Minute 1 — The problem and the idea**
> "I built this to solve a real problem my father had — he's a retail stock trader and spends hours manually checking metrics across stocks on Screener.in, which is the dominant tool in India but has a dense UI and slow complex filters. I wanted to build something faster and cleaner. The business value is: find the best-quality stocks by fundamentals in seconds instead of hours."

**Minute 2 — The data pipeline**
> "The core engineering decision was to pre-compute everything. I have a background scheduler — APScheduler — that fires at 6:30 AM IST daily. It does three things: loads the list of 500 symbols from a CSV, calls yfinance in batches of 10 with 1-second delays to avoid rate limiting, and fetches NSE's public shareholding CSV archive to extract promoter holding percentages. The tricky part was yfinance — it's unofficial, some symbols return empty dictionaries, some throw network errors. The fetcher handles all of that gracefully with try/except per symbol so one bad fetch doesn't kill the whole pipeline. NSE's CSV URLs also change quarterly, so I try multiple candidate URLs at runtime."

**Minute 3 — The backend**
> "FastAPI on Python 3.12. SQLAlchemy 2 with a query builder that constructs SQL WHERE clauses dynamically based on which filters are active — never Python-level filtering, always pushed down to the database. Pydantic schemas for request/response validation. The stock detail endpoint returns sector rank percentiles — so for any stock you can see 'this stock's ROE is in the 90th percentile of its sector peers'. 23 tests using pytest and httpx. Deployed on Railway using Nixpacks — no Dockerfile needed."

**Minute 4 — The frontend**
> "React 18 with TypeScript throughout. TanStack Table v8 for the data grid — all sorting and pagination is server-side, meaning every sort triggers a new API call with the sort parameter, not a client-side array sort. This matters because you can't load 500 rows client-side cleanly. TanStack Query handles caching so switching tabs doesn't re-fetch unnecessarily. The StockDetailModal shows a stock's metrics with color-coded sector percentile rankings and Recharts sparklines showing 4-quarter historical trends for ROE and P/E. The PresetBar has built-in screens and lets you save custom filter combinations to localStorage."

**Minute 5 — Phase 2 and what I'd do next**
> "Phase 2 added the Sector Overview tab — a table showing every sector's average P/E, ROE, and debt-to-equity with proportional bar charts, so you can quickly see which sectors are undervalued or high-quality. I also added a MetricHistory table to store quarterly snapshots, which is what powers the sparklines. If I were to continue, Phase 3 would add backtesting — given a filter screen, show what the returns would have been historically. That requires storing daily prices, not just point-in-time fundamentals."

---

## TECH STACK — DEEP QUESTIONS

### Python / FastAPI

**Q: Why FastAPI over Flask or Django?**
> FastAPI gives automatic OpenAPI docs, async support, and Pydantic validation built in — no extra setup. Flask needs plugins for all of that. Django is overkill for a read-only API with 4 endpoints. FastAPI also has the best performance of the three because of Starlette underneath.

**Q: What is Pydantic used for?**
> Two things: request/response schemas and settings management. `StockOut` is a Pydantic model that validates what the API returns — if a field is missing or the wrong type, FastAPI catches it before it reaches the client. `pydantic-settings` reads environment variables into a typed `Settings` class, so I get autocomplete and type safety on config values.

**Q: What is dependency injection in FastAPI?**
> `Depends(get_session)` injects a database session into each route function. The session is created per request and closed after the response — FastAPI handles the lifecycle. This means routes don't need to manage database connections manually, and tests can swap in a test database by overriding the dependency.

**Q: How does SQLAlchemy 2 differ from SQLAlchemy 1?**
> SQLAlchemy 2 uses the new `select()` style instead of `session.query()`. It's more explicit and composable — you build a `Select` object and execute it. `session.scalars(select(Stock))` returns ORM objects. It also dropped a lot of legacy patterns.

**Q: How does the query builder work?**
> It starts with `select(Stock)`, then conditionally chains `.where()` clauses based on which filter parameters are not None. For sorting it uses `getattr(Stock, sort_by)` to get the column dynamically, then calls `.desc().nulls_last()` or `.asc().nulls_last()`. Total count is computed with a subquery: `select(func.count()).select_from(q.subquery())`.

**Q: Why nulls_last() in sorting?**
> Stocks with missing data (e.g. no P/E because it's a loss-making company) would otherwise sort to the top or bottom depending on the database. `nulls_last()` pushes them to the end so they don't dominate the sort results.

**Q: How does APScheduler work here?**
> `AsyncIOScheduler` is created in the FastAPI lifespan context manager — it starts when the app starts and shuts down when the app stops. The pipeline job is registered with a `CronTrigger` for 6:30 AM IST. The job itself is an `async` function that uses `loop.run_in_executor` to run the blocking yfinance calls in a thread pool, keeping the event loop free.

**Q: Why run_in_executor for yfinance?**
> yfinance is a synchronous library — it makes blocking HTTP requests. Calling it directly in an async function would block the event loop and freeze the entire FastAPI server. `run_in_executor` runs it in a thread pool so the event loop stays responsive.

---

### React / Frontend

**Q: Why TanStack Table instead of a simple HTML table or AG Grid?**
> TanStack Table is headless — it gives you state management (sorting, pagination, column definitions) but zero UI. You write your own JSX. AG Grid gives you a pre-built UI that's hard to customize and heavy. A plain HTML table can't handle server-side sort/pagination state cleanly. TanStack Table is the right level of abstraction.

**Q: What is server-side vs client-side sorting?**
> Client-side: fetch all 500 rows once, sort in the browser with array sort. Fast after initial load but wastes bandwidth and memory. Server-side: every sort change triggers a new API call with `sort_by` and `sort_dir` parameters, database returns the pre-sorted page. Better for large datasets. Here we use server-side because the database is the right place to sort 500 rows with NULLs correctly.

**Q: What does TanStack Query do?**
> It's a data-fetching and caching library. `useQuery` with a `queryKey` caches the response — if you switch to the Sectors tab and come back, the stocks data isn't re-fetched if it's still fresh. `placeholderData: (prev) => prev` keeps the previous data visible while a new page or sort is loading so the table doesn't flash empty. `staleTime` controls how long data is considered fresh before background refetch.

**Q: How does the FilterPanel communicate with the table?**
> The filter state lives in `App.tsx` — a `Filters` object with string values for each field. FilterPanel receives `filters` and `onChange` as props, calls `onChange` when any input changes. App passes the filters to `useStocks` which passes them as query parameters to the API. When filters change, the query key changes, triggering a new fetch.

**Q: Why string values in the Filters type instead of numbers?**
> Controlled inputs in React need to bind to a string — an empty input is `""` not `null`. If we used `number | null`, the input would show `0` when cleared instead of being empty. String values convert to numbers in the API call only when the field is non-empty.

**Q: What is the StockDetailModal's sector percentile and how is it calculated?**
> When you fetch a stock detail, the backend finds all other stocks in the same sector and computes what percentage of peers have a lower value for each metric. A 90th percentile ROE means this stock's ROE is higher than 90% of its sector peers. Higher is better for ROE, lower is better for P/E and debt — the `higherBetter` flag controls the color coding.

**Q: What does the Sparkline component use?**
> Recharts `LineChart` with `ResponsiveContainer` for auto-sizing. It only renders if there are at least 2 data points (otherwise a trend line is meaningless). The x-axis is quarter labels like "Q1FY26", y-axis is the metric value. It shows in StockDetailModal for ROE and P/E history pulled from the `metric_history` table.

---

### Data / Pipeline

**Q: What is yfinance and what are its limitations?**
> yfinance is an unofficial Python library that scrapes/reverse-engineers Yahoo Finance's API. It's not sanctioned by Yahoo. Limitations: rate limiting (too many calls too fast gets blocked), unreliable — returns change without notice, some Indian symbols need `.NS` suffix (NSE) or `.BO` (BSE), missing data is common for smaller companies. It's acceptable for a resume project but not for production trading systems.

**Q: How do you handle yfinance failures?**
> The fetcher processes symbols in batches of 10 with a 1-second sleep between batches. Each symbol is wrapped in try/except — if one fails, it logs the error and continues. The result is a list of only successfully fetched stocks. If yfinance returns an empty dict for a symbol, it's skipped. This means some stocks may have stale data if they consistently fail, but the pipeline doesn't crash.

**Q: What is promoter holding and why does it matter?**
> Promoter holding is the percentage of shares owned by the company's founders/management. High promoter holding (>50%) generally signals confidence — the people who know the company best are holding their shares. Low promoter holding or declining promoter holding can be a red flag. NSE publishes this quarterly in public CSV files.

**Q: How does the MetricHistory table work?**
> Every time the pipeline runs, after upserting the stocks table, it also inserts rows into `metric_history` for 4 metrics (P/E, ROE, Revenue Growth, D/E) for every stock. Each row has a symbol, metric name, value, quarter label (e.g. "Q2FY26"), and timestamp. The `get_metric_history` query returns the 8 most recent rows per metric per stock, sorted oldest-first, which is what the sparkline displays.

**Q: How is the quarter label computed?**
> Based on Indian financial year: Q1 = April–June, Q2 = July–September, Q3 = October–December, Q4 = January–March. The pipeline determines the current quarter from the UTC month and constructs a label like "Q2FY26". FY year = calendar year + 1 if month ≥ April.

---

### Infrastructure / Deployment

**Q: Why Railway for the backend?**
> Railway supports Python out of the box with Nixpacks — it detects `requirements.txt` and builds automatically. No Dockerfile needed. It also offers managed PostgreSQL as a plugin in the same project. The free tier is enough for a resume project. Alternatives are Render (similar free tier) and Heroku (no longer free).

**Q: Why Vercel for the frontend?**
> Vercel is built by the team behind Next.js and has the best Vite/React support of any platform. Automatic preview deployments on every push, global CDN, free tier for personal projects. Zero configuration — it detects Vite automatically from `vercel.json`.

**Q: How does the frontend know where the backend is?**
> `VITE_API_URL` environment variable set in Vercel. Vite bakes env vars prefixed with `VITE_` into the build at compile time — they become part of the JavaScript bundle. The `api.ts` file reads `import.meta.env.VITE_API_URL` to construct API URLs.

**Q: What is CORS and why do you need it?**
> Cross-Origin Resource Sharing — browsers block JavaScript on one domain from calling APIs on a different domain by default. The Vercel frontend (nse-screener.vercel.app) calling the Railway backend (railway.app) is a cross-origin request. FastAPI's `CORSMiddleware` adds `Access-Control-Allow-Origin` headers to responses, explicitly allowing the Vercel domain.

**Q: SQLite in dev, PostgreSQL in prod — how does that work?**
> SQLAlchemy abstracts the database through the `DATABASE_URL` connection string. `sqlite:///./nse_screener.db` uses SQLite locally. `postgresql://user:pass@host/db` uses PostgreSQL in production. The same models, queries, and migrations work with both — SQLAlchemy handles the dialect differences.

**Q: How does the database initialize on first deploy?**
> The FastAPI `lifespan` context manager calls `init_db()` on startup. `init_db()` calls `Base.metadata.create_all(engine)` which creates all tables that don't already exist. It's idempotent — safe to run on every startup. On first deploy with PostgreSQL, all tables (stocks, metric_history) are created automatically.

---

## COMMON INTERVIEW QUESTIONS

**Q: What was the hardest part?**
> Getting reliable data. yfinance is unofficial and inconsistent — some symbols return empty dicts, some throw exceptions, some return data in different formats for Indian vs US stocks. Building a fetcher resilient enough to handle 500 symbols without crashing took iteration. The NSE shareholding CSV URLs also change every quarter — the parser tries multiple URL patterns at runtime.

**Q: What would you do differently?**
> Use a proper data vendor instead of yfinance — something like Angel One SmartAPI or Twelve Data which have official APIs and SLAs. I'd also add proper error alerting (email/Slack when the pipeline fails) and a way to backfill historical data, not just today's snapshot. For the frontend, I'd add virtualization for the table rows using TanStack Virtual if scaling beyond 500 stocks.

**Q: How would you scale this to 5000 stocks?**
> The pipeline would need parallelism — instead of sequential batches, use `asyncio.gather` with rate limiting to fetch multiple symbols concurrently. The database queries are already indexed on the primary key (symbol) and use SQL-level pagination, so they'd scale without changes. The frontend is already paginated — 20 rows per page regardless of total count.

**Q: How would you add user authentication?**
> FastAPI has OAuth2 with JWT support built in via `fastapi.security`. I'd add a `users` table, a login endpoint that returns a JWT, and a `Depends(get_current_user)` dependency on protected routes. For a screener with saved personal screens, users would need accounts. The `PresetBar` currently uses localStorage — with auth, presets would move server-side to the database.

**Q: How do you test the API?**
> pytest with httpx's `AsyncClient` and a test SQLite database. The `conftest.py` creates an in-memory SQLite database, seeds it with two test stocks, and overrides FastAPI's `get_session` dependency to use it. Every test gets a clean database. Tests cover filtering, sorting, pagination, the detail endpoint, sector stats, and meta endpoint — 23 tests total.

**Q: What is the MetaOut endpoint for?**
> `GET /api/meta` returns the last pipeline run time, total stock count, and pipeline status (`"empty"` if no data yet, `"ok"` if data exists). The frontend polls this every 60 seconds to show the "Updated X days ago" indicator in the header and the "Run pipeline to populate data" warning when the database is empty.

**Q: Why is promoter holding data from NSE CSVs and not yfinance?**
> yfinance's institutional holding data is sourced from SEC filings (US) — it's incomplete or wrong for Indian stocks. NSE publishes official quarterly shareholding pattern CSVs on their website. These are the authoritative source for promoter holding in India. Parsing them directly is more work but gives accurate data.

**Q: What is the difference between P/E ratio and ROE?**
> P/E (Price-to-Earnings) is a valuation metric — how much investors pay per rupee of earnings. Lower P/E can mean undervalued. ROE (Return on Equity) is a profitability metric — how efficiently a company generates profit from shareholders' equity. Higher ROE means the company is better at turning equity into profit. A "value" screen looks for low P/E + decent ROE. A "quality" screen looks for high ROE regardless of valuation.

**Q: What is Debt/Equity ratio?**
> Total debt divided by shareholder equity. Measures financial leverage. D/E of 0.5 means for every ₹1 of equity, the company has ₹0.50 of debt. High D/E (>2) means the company is heavily debt-financed — more risk if earnings fall. Capital-intensive sectors like utilities and real estate naturally have higher D/E than tech companies.

**Q: What is revenue growth YoY?**
> Year-over-year revenue growth — percentage change in revenue compared to the same period last year. Tells you if the company is growing its top line. High revenue growth + high ROE is the classic "growth quality" combo that fund managers look for.

---

## WHAT THE PROJECT DEMONSTRATES (for interviews)

| Skill | Evidence |
|---|---|
| Backend API design | FastAPI with proper schemas, dependency injection, error handling |
| Database design | Two normalized tables, query builder, indexing, SQL aggregations |
| Data engineering | Batch pipeline, rate limiting, error resilience, multiple data sources |
| Frontend architecture | Component composition, state management, server-side data handling |
| TypeScript | Full type safety across all frontend code, no `any` types |
| Testing | 23 tests, dependency injection override for test isolation |
| Deployment | CI/CD via GitHub → Railway/Vercel auto-deploy on push |
| System design | Pre-computation pattern, separation of pipeline vs API concerns |
| Domain knowledge | Understands P/E, ROE, D/E, Revenue Growth, Promoter Holding |

---

## FINANCE VOCABULARY CHEAT SHEET

| Term | One-line definition |
|---|---|
| NIFTY 500 | Index of India's top 500 companies by market cap on NSE |
| NSE | National Stock Exchange of India — main Indian stock exchange |
| BSE | Bombay Stock Exchange — India's oldest exchange |
| Market Cap | Total value of all shares = share price × number of shares |
| P/E Ratio | Price per share ÷ earnings per share. Lower = potentially cheaper |
| ROE | Net profit ÷ shareholders' equity × 100. Higher = more efficient |
| Debt/Equity | Total debt ÷ equity. Higher = more leveraged, more risk |
| Revenue Growth YoY | (This year revenue − Last year revenue) ÷ Last year revenue × 100 |
| Promoter Holding | % shares owned by founders/management. Higher = more skin in game |
| Current Ratio | Current assets ÷ current liabilities. >1 means can cover short-term debt |
| 52-week High | Highest stock price in the last 52 weeks — context for current price |
| Sector Percentile | Rank within sector peers — 90th means better than 90% of sector |
| Fundamental Analysis | Evaluating stocks based on financial metrics, not price charts |
| Technical Analysis | Evaluating stocks based on price patterns and chart signals |
| Screener | Tool for filtering stocks based on criteria — like a database query for stocks |

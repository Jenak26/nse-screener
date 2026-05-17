# Phase 3: Analytics + Production — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backtesting engine, market breadth, heatmaps, migrate to PostgreSQL, and deploy on a VPS with 24/7 uptime.

**Architecture:** Backtesting reads historically stored signals + candles and computes outcomes. PostgreSQL replaces SQLite via connection string swap. VPS deployment uses systemd + Nginx. No schema changes required — SQLAlchemy abstraction handles the switch.

**Tech Stack:** All Phase 2 deps + psycopg2-binary (PostgreSQL), Nginx (server), systemd (Linux service)

**Prerequisite:** Phase 2 complete. All Phase 2 tests passing.

---

## File Map (additions to Phase 2)

| File | Responsibility |
|---|---|
| `backend/backtesting/engine.py` | Compute pattern outcomes from historical signals |
| `backend/backtesting/metrics.py` | Win rate, avg RR, drawdown, profitability |
| `database/models.py` | Add `backtest_results` table |
| `database/queries.py` | Add backtest query helpers |
| `app/pages/12_backtesting.py` | Backtesting dashboard page |
| `app/pages/13_market_breadth.py` | Market Breadth page |
| `app/pages/14_heatmaps.py` | Sector + stock heatmaps |
| `deploy/tradad.service` | systemd service file |
| `deploy/nginx.conf` | Nginx reverse proxy config |
| `deploy/setup_vps.sh` | VPS setup script |

---

## Task 1: Backtesting Engine

**Files:**
- Add `BacktestResult` to `database/models.py`
- Create: `backend/backtesting/engine.py`
- Create: `backend/backtesting/metrics.py`
- Create: `tests/test_backtesting.py`

- [ ] **Step 1: Add `BacktestResult` model to `database/models.py`**

```python
# Add to database/models.py
class BacktestResult(Base):
    __tablename__ = "backtest_results"
    id = Column(Integer, primary_key=True, autoincrement=True)
    pattern_name = Column(Text, nullable=False)
    timeframe = Column(Text, nullable=False)
    signal_timestamp = Column(Integer, nullable=False)
    symbol = Column(Text, nullable=False)
    direction = Column(Text)
    entry_price = Column(Real)
    outcome_1d = Column(Real)   # % return after 1 day
    outcome_3d = Column(Real)   # % return after 3 days
    outcome_5d = Column(Real)   # % return after 5 days
    is_winner = Column(Integer, default=0)   # 1 if profitable
    computed_at = Column(Integer)
```

Run `init_db()` once — `create_all` adds the new table without affecting existing ones.

- [ ] **Step 2: Write failing test**

```python
# tests/test_backtesting.py
import os
os.environ["DB_PATH"] = ":memory:"

import pandas as pd
from backend.backtesting.metrics import compute_metrics

def test_compute_metrics_win_rate():
    results = [
        {"is_winner": 1, "outcome_5d": 2.5},
        {"is_winner": 1, "outcome_5d": 3.1},
        {"is_winner": 0, "outcome_5d": -1.2},
        {"is_winner": 0, "outcome_5d": -0.8},
    ]
    df = pd.DataFrame(results)
    m = compute_metrics(df)
    assert m["win_rate"] == 50.0
    assert m["avg_return_5d"] > 0
    assert "total_signals" in m

def test_compute_metrics_empty():
    m = compute_metrics(pd.DataFrame())
    assert m["win_rate"] == 0
    assert m["total_signals"] == 0
```

- [ ] **Step 3: Run test — confirm fails**

```powershell
pytest tests/test_backtesting.py -v
```

- [ ] **Step 4: Create `backend/backtesting/metrics.py`**

```python
import pandas as pd

def compute_metrics(results_df: pd.DataFrame) -> dict:
    if results_df.empty:
        return {"win_rate": 0, "avg_return_5d": 0, "avg_return_1d": 0,
                "avg_return_3d": 0, "total_signals": 0, "max_win": 0, "max_loss": 0}
    n = len(results_df)
    winners = results_df["is_winner"].sum()
    return {
        "total_signals":  n,
        "win_rate":       round(winners / n * 100, 1),
        "avg_return_1d":  round(results_df["outcome_1d"].mean(), 2) if "outcome_1d" in results_df else 0,
        "avg_return_3d":  round(results_df["outcome_3d"].mean(), 2) if "outcome_3d" in results_df else 0,
        "avg_return_5d":  round(results_df["outcome_5d"].mean(), 2) if "outcome_5d" in results_df else 0,
        "max_win":        round(results_df["outcome_5d"].max(), 2),
        "max_loss":       round(results_df["outcome_5d"].min(), 2),
    }
```

- [ ] **Step 5: Create `backend/backtesting/engine.py`**

```python
import time, logging
import pandas as pd
from database.db import get_session
from database.models import DetectedPattern, Candle, BacktestResult

logger = logging.getLogger(__name__)

OUTCOME_DAYS = [1, 3, 5]

def _get_price_n_days_after(symbol: str, signal_ts: int, days: int) -> float | None:
    target_ts = signal_ts + days * 86400
    session = get_session()
    try:
        row = (session.query(Candle)
               .filter(Candle.symbol == symbol,
                       Candle.timeframe == "Daily",
                       Candle.timestamp >= target_ts)
               .order_by(Candle.timestamp.asc())
               .first())
        return row.close if row else None
    finally:
        session.close()

def run_backtest():
    """For each historical pattern signal, compute price outcomes and write BacktestResult."""
    session = get_session()
    try:
        # Only process signals not yet back-tested
        existing_ts = {r.signal_timestamp for r in session.query(BacktestResult.signal_timestamp).all()}
        signals = (session.query(DetectedPattern)
                   .filter(DetectedPattern.detected_at.notin_(existing_ts))
                   .order_by(DetectedPattern.detected_at.asc())
                   .limit(2000)
                   .all())
    finally:
        session.close()

    now = int(time.time())
    processed = 0
    session = get_session()
    try:
        for sig in signals:
            # Need at least 5 days of future data — skip recent signals
            if now - sig.detected_at < 5 * 86400:
                continue
            entry = _get_price_n_days_after(sig.symbol, sig.detected_at, 0)
            if entry is None or entry == 0:
                continue
            outcomes = {}
            for d in OUTCOME_DAYS:
                future = _get_price_n_days_after(sig.symbol, sig.detected_at, d)
                if future:
                    outcomes[d] = round((future - entry) / entry * 100, 3)
                else:
                    outcomes[d] = None

            outcome_5d = outcomes.get(5)
            is_winner = 1 if (outcome_5d is not None and (
                (sig.trend_direction == "bullish" and outcome_5d > 0) or
                (sig.trend_direction == "bearish" and outcome_5d < 0)
            )) else 0

            session.add(BacktestResult(
                pattern_name=sig.pattern_name,
                timeframe=sig.timeframe,
                signal_timestamp=sig.detected_at,
                symbol=sig.symbol,
                direction=sig.trend_direction,
                entry_price=entry,
                outcome_1d=outcomes.get(1),
                outcome_3d=outcomes.get(3),
                outcome_5d=outcome_5d,
                is_winner=is_winner,
                computed_at=now,
            ))
            processed += 1

        session.commit()
        logger.info(f"Backtest: processed {processed} signals")
    except Exception as e:
        session.rollback()
        logger.error(f"Backtest error: {e}")
    finally:
        session.close()
```

- [ ] **Step 6: Add query helper to `database/queries.py`**

```python
# Add to database/queries.py
from database.models import BacktestResult

def get_backtest_stats() -> pd.DataFrame:
    """Returns per-pattern backtest metrics."""
    session = get_session()
    try:
        rows = session.query(BacktestResult).all()
        if not rows:
            return pd.DataFrame()
        df = pd.DataFrame([{
            "pattern": r.pattern_name, "timeframe": r.timeframe,
            "is_winner": r.is_winner, "outcome_1d": r.outcome_1d,
            "outcome_3d": r.outcome_3d, "outcome_5d": r.outcome_5d,
        } for r in rows])
        return df
    finally:
        session.close()
```

- [ ] **Step 7: Schedule backtest in `main.py`**

```python
from backend.backtesting.engine import run_backtest
# In start_scheduler():
scheduler.add_job(run_backtest, "cron", hour="18", minute="30")
```

- [ ] **Step 8: Run tests**

```powershell
pytest tests/test_backtesting.py -v
```

Expected: 2 PASSED

- [ ] **Step 9: Commit**

```powershell
git add backend/backtesting/ database/models.py database/queries.py tests/test_backtesting.py main.py
git commit -m "feat: backtesting engine with per-pattern win rate and outcome metrics"
```

---

## Task 2: Backtesting Dashboard Page

**Files:**
- Create: `app/pages/12_backtesting.py`

- [ ] **Step 1: Create `app/pages/12_backtesting.py`**

```python
import streamlit as st
import pandas as pd
import plotly.express as px
from database.queries import get_backtest_stats
from backend.backtesting.metrics import compute_metrics

st.set_page_config(page_title="Backtesting | TraDad", layout="wide")
st.title("📉 Pattern Backtesting")
st.caption("Historical performance of detected patterns. Based on stored signals since Phase 1 start.")

df = get_backtest_stats()

if df.empty:
    st.info("Backtest data not yet available. Runs daily at 6:30 PM IST after market close.")
    st.stop()

# Summary by pattern
patterns = df["pattern"].unique().tolist()
rows = []
for p in patterns:
    sub = df[df["pattern"] == p]
    m = compute_metrics(sub)
    rows.append({"Pattern": p.replace("_", " ").title(), **m})

summary = pd.DataFrame(rows).sort_values("win_rate", ascending=False)

st.subheader("Pattern Performance Summary")
st.dataframe(
    summary,
    use_container_width=True,
    hide_index=True,
    column_config={
        "win_rate": st.column_config.ProgressColumn("Win Rate %", min_value=0, max_value=100, format="%.1f%%"),
        "avg_return_5d": st.column_config.NumberColumn("Avg 5D Return %", format="%.2f%%"),
    }
)

# Win rate bar chart
fig = px.bar(summary, x="Pattern", y="win_rate", color="win_rate",
             color_continuous_scale="RdYlGn", range_color=[30, 70],
             title="Win Rate by Pattern (%)", labels={"win_rate": "Win Rate %"})
fig.update_layout(xaxis_tickangle=-30)
st.plotly_chart(fig, use_container_width=True)

# Drill down
selected = st.selectbox("Drill Down Pattern", patterns,
                        format_func=lambda x: x.replace("_", " ").title())
sub_df = df[df["pattern"] == selected][["timeframe","is_winner","outcome_1d","outcome_3d","outcome_5d"]]
st.dataframe(sub_df.head(50), use_container_width=True, hide_index=True)
```

- [ ] **Step 2: Verify page loads**

```powershell
streamlit run app/main_app.py
```

Navigate to Backtesting page. Verify empty state shows correctly.

- [ ] **Step 3: Commit**

```powershell
git add app/pages/12_backtesting.py
git commit -m "feat: Backtesting dashboard with per-pattern win rate charts"
```

---

## Task 3: Market Breadth Page

**Files:**
- Create: `app/pages/13_market_breadth.py`
- Create: `backend/indicators/breadth.py`

- [ ] **Step 1: Create `backend/indicators/breadth.py`**

```python
import pandas as pd
from database.db import get_session
from database.models import Candle, Stock

def compute_market_breadth() -> dict:
    session = get_session()
    try:
        stocks = session.query(Stock.symbol).all()
        symbols = [r.symbol for r in stocks]
        advancing = 0
        declining = 0
        new_highs = 0
        new_lows = 0
        above_200_ema = 0
        total = 0

        for symbol in symbols:
            rows = (session.query(Candle)
                    .filter_by(symbol=symbol, timeframe="Daily")
                    .order_by(Candle.timestamp.desc())
                    .limit(200)
                    .all())
            if len(rows) < 2:
                continue
            closes = [r.close for r in reversed(rows)]
            total += 1
            # Advancing / declining
            if closes[-1] > closes[-2]:
                advancing += 1
            elif closes[-1] < closes[-2]:
                declining += 1
            # New 52-week high/low
            if len(closes) >= 252:
                if closes[-1] >= max(closes[:-1]):
                    new_highs += 1
                if closes[-1] <= min(closes[:-1]):
                    new_lows += 1
            # Above 200-day EMA
            if len(closes) >= 200:
                ema200 = sum(closes[-200:]) / 200
                if closes[-1] > ema200:
                    above_200_ema += 1

        return {
            "advancing": advancing,
            "declining": declining,
            "new_highs": new_highs,
            "new_lows": new_lows,
            "above_200_ema": above_200_ema,
            "total": total,
            "adv_pct": round(advancing / total * 100, 1) if total > 0 else 0,
        }
    finally:
        session.close()
```

- [ ] **Step 2: Create `app/pages/13_market_breadth.py`**

```python
import streamlit as st
from backend.indicators.breadth import compute_market_breadth

st.set_page_config(page_title="Market Breadth | TraDad", layout="wide")
st.title("📊 Market Breadth")

with st.spinner("Computing breadth..."):
    b = compute_market_breadth()

col1, col2, col3, col4, col5 = st.columns(5)
col1.metric("Advancing", b["advancing"])
col2.metric("Declining", b["declining"])
col3.metric("New 52W Highs", b["new_highs"])
col4.metric("New 52W Lows", b["new_lows"])
col5.metric("Above 200 EMA", b["above_200_ema"])

import plotly.graph_objects as go
fig = go.Figure(go.Indicator(
    mode="gauge+number",
    value=b["adv_pct"],
    title={"text": "Advance/Decline %"},
    gauge={"axis": {"range": [0, 100]},
           "bar": {"color": "green" if b["adv_pct"] > 50 else "red"},
           "steps": [{"range": [0, 40], "color": "#ffcccc"},
                     {"range": [40, 60], "color": "#ffffcc"},
                     {"range": [60, 100], "color": "#ccffcc"}]}
))
st.plotly_chart(fig, use_container_width=True)
```

- [ ] **Step 3: Commit**

```powershell
git add backend/indicators/breadth.py app/pages/13_market_breadth.py
git commit -m "feat: market breadth page with A/D ratio, new highs/lows, 200 EMA"
```

---

## Task 4: Heatmaps Page

**Files:**
- Create: `app/pages/14_heatmaps.py`

- [ ] **Step 1: Create `app/pages/14_heatmaps.py`**

```python
import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from database.queries import get_sector_strength, get_top_momentum_stocks

st.set_page_config(page_title="Heatmaps | TraDad", layout="wide")
st.title("🗺️ Market Heatmaps")

tab1, tab2 = st.tabs(["Sector Heatmap", "Top Stock Heatmap"])

with tab1:
    df = get_sector_strength()
    if df.empty:
        st.info("Sector data updating...")
    else:
        fig = go.Figure(go.Treemap(
            labels=df["sector"],
            values=[1] * len(df),
            parents=[""] * len(df),
            customdata=df["strength"],
            marker=dict(
                colors=df["strength"],
                colorscale="RdYlGn",
                cmin=0, cmax=1,
                showscale=True,
            ),
            texttemplate="<b>%{label}</b><br>%{customdata:.2f}",
        ))
        fig.update_layout(title="Sector Strength Heatmap", height=500)
        st.plotly_chart(fig, use_container_width=True)

with tab2:
    df2 = get_top_momentum_stocks(limit=100, fno_only=False)
    if df2.empty:
        st.info("Momentum data updating...")
    else:
        fig2 = go.Figure(go.Treemap(
            labels=df2["symbol"],
            values=[1] * len(df2),
            parents=df2.get("sector", [""] * len(df2)),
            customdata=df2["confidence"],
            marker=dict(
                colors=df2["confidence"],
                colorscale="RdYlGn",
                cmin=50, cmax=100,
                showscale=True,
            ),
            texttemplate="<b>%{label}</b><br>Conf: %{customdata}",
        ))
        fig2.update_layout(title="Top 100 Momentum Stocks Heatmap", height=600)
        st.plotly_chart(fig2, use_container_width=True)
```

- [ ] **Step 2: Commit**

```powershell
git add app/pages/14_heatmaps.py
git commit -m "feat: sector and stock heatmaps with Plotly Treemap"
```

---

## Task 5: PostgreSQL Migration

**Files:**
- Modify: `requirements.txt`
- Modify: `.env.example`
- Modify: `database/db.py`

- [ ] **Step 1: Add psycopg2 to `requirements.txt`**

```text
psycopg2-binary>=2.9
```

- [ ] **Step 2: Update `.env.example` with Postgres option**

```text
# SQLite (Phase 1/2 default)
DB_PATH=tradad.db

# PostgreSQL (Phase 3 — uncomment when ready)
# DATABASE_URL=postgresql://tradad:password@localhost:5432/tradad
```

- [ ] **Step 3: Update `database/db.py` to support both**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database.models import Base
from config.settings import DB_PATH
import os

def _get_database_url() -> str:
    pg_url = os.getenv("DATABASE_URL", "")
    if pg_url:
        return pg_url
    return f"sqlite:///{DB_PATH}"

_url = _get_database_url()
_connect_args = {"check_same_thread": False} if _url.startswith("sqlite") else {}
engine = create_engine(_url, echo=False, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine)

def init_db():
    Base.metadata.create_all(engine)

def get_session():
    return SessionLocal()
```

- [ ] **Step 4: Install Postgres locally (for testing)**

On Windows, install PostgreSQL 16 from https://www.postgresql.org/download/windows/ then:

```powershell
psql -U postgres -c "CREATE DATABASE tradad;"
psql -U postgres -c "CREATE USER tradad WITH PASSWORD 'password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE tradad TO tradad;"
```

- [ ] **Step 5: Test with Postgres**

In `.env`, add:
```
DATABASE_URL=postgresql://tradad:password@localhost:5432/tradad
```

```powershell
python -c "from database.db import init_db; init_db(); print('Postgres OK')"
```

Expected: `Postgres OK`

- [ ] **Step 6: Run all tests with SQLite (keep tests using `:memory:`)**

```powershell
pytest tests/ -v
```

Expected: All PASSED (tests use in-memory SQLite, unaffected by DB_URL)

- [ ] **Step 7: Commit**

```powershell
git add database/db.py requirements.txt .env.example
git commit -m "feat: dual SQLite/PostgreSQL support via DATABASE_URL env var"
```

---

## Task 6: VPS Deployment

**Files:**
- Create: `deploy/tradad.service`
- Create: `deploy/nginx.conf`
- Create: `deploy/setup_vps.sh`

- [ ] **Step 1: Create `deploy/tradad.service`**

```ini
[Unit]
Description=TraDad Market Intelligence Dashboard
After=network.target

[Service]
Type=simple
User=tradad
WorkingDirectory=/home/tradad/tradad
ExecStart=/home/tradad/tradad/venv/bin/python main.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
EnvironmentFile=/home/tradad/tradad/.env

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: Create `deploy/nginx.conf`**

```nginx
server {
    listen 80;
    server_name your_vps_ip_or_domain;

    location / {
        proxy_pass http://127.0.0.1:8501;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
```

Replace `your_vps_ip_or_domain` with the actual IP or domain.

- [ ] **Step 3: Create `deploy/setup_vps.sh`**

```bash
#!/bin/bash
# Run as root on fresh Ubuntu 22.04 VPS
set -e

echo "=== Installing system packages ==="
apt update && apt install -y python3.12 python3.12-venv python3-pip nginx git

echo "=== Creating tradad user ==="
useradd -m -s /bin/bash tradad || true

echo "=== Clone repo ==="
# Replace with your actual repo URL or copy files manually
# git clone https://github.com/yourusername/tradad.git /home/tradad/tradad
echo "Copy project files to /home/tradad/tradad then continue"

echo "=== Setup Python venv ==="
su - tradad -c "
cd /home/tradad/tradad
python3.12 -m venv venv
venv/bin/pip install -r requirements.txt
"

echo "=== Install systemd service ==="
cp /home/tradad/tradad/deploy/tradad.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable tradad
systemctl start tradad

echo "=== Setup Nginx ==="
cp /home/tradad/tradad/deploy/nginx.conf /etc/nginx/sites-available/tradad
ln -sf /etc/nginx/sites-available/tradad /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo "=== Done. Dashboard available at http://your_vps_ip ==="
```

- [ ] **Step 4: Deploy to VPS**

```bash
# On your local machine — copy project to VPS
scp -r . root@your_vps_ip:/home/tradad/tradad

# SSH into VPS
ssh root@your_vps_ip

# Run setup script
bash /home/tradad/tradad/deploy/setup_vps.sh

# Copy .env file manually (do NOT commit .env)
scp .env root@your_vps_ip:/home/tradad/tradad/.env

# Check service is running
systemctl status tradad
```

- [ ] **Step 5: Verify deployment**

Open `http://your_vps_ip` in browser.
Verify dashboard loads. Check logs:

```bash
journalctl -u tradad -f
```

- [ ] **Step 6: Commit deploy files**

```powershell
git add deploy/
git commit -m "feat: VPS deployment — systemd service, Nginx reverse proxy, setup script"
git tag v3.0.0-phase3
```

---

## Task 7: Final Integration Test

- [ ] **Step 1: Run full test suite**

```powershell
pytest tests/ -v --tb=short
```

Expected: All tests PASSED

- [ ] **Step 2: End-to-end smoke test (local)**

```powershell
python main.py
```

Verify in browser at `http://localhost:8501`:
- Home page loads with top stocks table (may be empty if market closed)
- Pattern Scanner page loads, filters work
- Momentum Rankings page loads
- Breakout Detection page loads
- Sector Rotation page loads
- Backtesting page shows empty state or data
- Market Breadth page loads
- Heatmaps page loads
- Options Ideas page shows disclaimer

- [ ] **Step 3: Tag final release**

```powershell
git tag v3.0.0-final
```

---

## Phase 3 Complete — Full System Delivered

| Phase | Status | Features |
|---|---|---|
| 1 | Done | 8 patterns, 2 pages, Telegram, APScheduler, SQLite |
| 2 | Done | 21 patterns, 5-factor scoring, 11 pages, sector/RS/momentum engines |
| 3 | Done | Backtesting, market breadth, heatmaps, PostgreSQL, VPS deployment |

The system answers **"What are the best setups in the market RIGHT NOW?"** within 1–5 seconds.

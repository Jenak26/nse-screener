import time
import streamlit as st
from database.db import init_db, get_session
from database.models import Stock
from database.queries import get_recent_signals
from app.components.tables import render_signals_table

init_db()

st.set_page_config(page_title="Pattern Scanner | TraDad", layout="wide")
st.title("🔍 Pattern Scanner")
st.caption("Results pre-computed by background scanner. Auto-refreshes every 30 seconds.")

PATTERN_NAMES = [
    "hammer", "engulfing", "morning_star", "doji",
    "orb", "vwap_bounce", "volume_breakout", "gap_up",
]
TIMEFRAMES = ["5m", "15m", "1H", "Daily"]


def _get_sectors() -> list[str]:
    session = get_session()
    try:
        rows = session.query(Stock.sector).distinct().all()
        return sorted([r.sector for r in rows if r.sector])
    finally:
        session.close()


def _get_fno_set() -> set[str]:
    session = get_session()
    try:
        return {r.symbol for r in session.query(Stock.symbol).filter_by(is_fno=1).all()}
    finally:
        session.close()


# Sidebar filters
with st.sidebar:
    st.header("Filters")
    selected_patterns = st.multiselect(
        "Patterns",
        options=PATTERN_NAMES,
        default=PATTERN_NAMES,
        format_func=lambda x: x.replace("_", " ").title(),
    )
    selected_timeframes = st.multiselect("Timeframes", TIMEFRAMES, default=TIMEFRAMES)
    min_confidence = st.slider("Min Confidence", 50, 95, 70, step=5)
    sectors = _get_sectors()
    selected_sector = st.selectbox("Sector", ["All"] + sectors)
    fno_only = st.toggle("F&O Only", value=False)

# Fetch and filter signals
df = get_recent_signals(hours=24, min_confidence=min_confidence)

if not df.empty:
    if selected_patterns:
        df = df[df["pattern"].isin(selected_patterns)]
    if selected_timeframes:
        df = df[df["timeframe"].isin(selected_timeframes)]
    if selected_sector != "All":
        session = get_session()
        try:
            stock_sectors = {r.symbol: r.sector for r in session.query(Stock).all()}
        finally:
            session.close()
        df["sector"] = df["symbol"].map(stock_sectors)
        df = df[df["sector"] == selected_sector]
    if fno_only:
        fno_set = _get_fno_set()
        df = df[df["symbol"].isin(fno_set)]

col1, col2 = st.columns([1, 4])
with col1:
    st.metric("Signals Found", len(df) if not df.empty else 0)
with col2:
    if st.button("🔄 Refresh Now"):
        st.rerun()

render_signals_table(df)

# Auto-refresh every 30 seconds
time.sleep(30)
st.rerun()

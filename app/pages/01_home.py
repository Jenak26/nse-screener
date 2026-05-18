import time
import streamlit as st
from database.db import init_db
from database.queries import get_recent_signals, get_top_momentum_stocks, get_sector_strength
from app.components.tables import render_signals_table, render_top_stocks_table
from app.components.metrics import render_index_card
from app.components.charts import render_sector_bar

init_db()

st.set_page_config(page_title="Home | TraDad", layout="wide")
st.title("🏠 Market Overview")

REFRESH_SECS = 15

# Market indices row (placeholder values — will be live in Phase 2)
st.subheader("Market Indices")
col1, col2, col3 = st.columns(3)
with col1:
    render_index_card("NIFTY 50", 22450.0, 0.45, "Bullish")
with col2:
    render_index_card("BANKNIFTY", 48200.0, -0.22, "Bearish")
with col3:
    render_index_card("FINNIFTY", 21300.0, 0.10, "Neutral")

st.divider()

# Top stocks tabs
tab1, tab2 = st.tabs(["🔥 Top 50 Momentum (All)", "📊 Top 50 F&O Stocks"])

with tab1:
    df_all = get_top_momentum_stocks(limit=50, fno_only=False)
    render_top_stocks_table(df_all, "Top 50 Momentum Stocks")

with tab2:
    df_fno = get_top_momentum_stocks(limit=50, fno_only=True)
    render_top_stocks_table(df_fno, "Top 50 F&O Momentum Stocks")

st.divider()

# Sector strength
st.subheader("Sector Strength")
df_sectors = get_sector_strength()
fig = render_sector_bar(df_sectors)
if fig.data:
    st.plotly_chart(fig, use_container_width=True)
else:
    st.info("Sector data will appear after the first hourly scan.")

st.divider()

# Live alerts feed
st.subheader("⚡ Live Alerts Feed (Last 24h)")
df_signals = get_recent_signals(hours=24, min_confidence=65)
render_signals_table(df_signals.head(20) if not df_signals.empty else df_signals)

# Auto-refresh
time.sleep(REFRESH_SECS)
st.rerun()

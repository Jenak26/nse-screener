import streamlit as st


def render_index_card(name: str, ltp: float, change_pct: float, trend: str) -> None:
    color = "🟢" if change_pct >= 0 else "🔴"
    trend_icon = "↑" if trend == "Bullish" else "↓" if trend == "Bearish" else "→"
    st.metric(
        label=f"{color} {name}",
        value=f"{ltp:,.1f}",
        delta=f"{change_pct:+.2f}% {trend_icon}",
    )

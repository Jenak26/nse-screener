import pandas as pd
import streamlit as st
from datetime import datetime
from zoneinfo import ZoneInfo


def render_signals_table(df: pd.DataFrame) -> None:
    if df.empty:
        st.info("No signals found.")
        return
    display = df.copy()
    if "detected_at" in display.columns:
        IST = ZoneInfo("Asia/Kolkata")
        display["time"] = display["detected_at"].apply(
            lambda ts: datetime.fromtimestamp(ts, tz=IST).strftime("%H:%M")
        )
        display = display.drop(columns=["detected_at"])
    st.dataframe(
        display,
        use_container_width=True,
        column_config={
            "confidence": st.column_config.ProgressColumn(
                "Confidence", min_value=0, max_value=100, format="%d%%"
            ),
        },
        hide_index=True,
    )


def render_top_stocks_table(df: pd.DataFrame, title: str = "Top Stocks") -> None:
    if df.empty:
        st.info(f"No data for {title} yet. Check back after market opens.")
        return
    st.subheader(title)
    st.dataframe(
        df,
        use_container_width=True,
        column_config={
            "confidence": st.column_config.ProgressColumn(
                "Confidence", min_value=0, max_value=100, format="%d%%"
            ),
        },
        hide_index=True,
    )

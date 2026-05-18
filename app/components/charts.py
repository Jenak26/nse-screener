import plotly.graph_objects as go
import pandas as pd


def render_sector_bar(df: pd.DataFrame) -> go.Figure:
    if df.empty:
        return go.Figure()
    df_sorted = df.sort_values("strength", ascending=True)
    colors = ["#e74c3c" if v < 0.5 else "#2ecc71" for v in df_sorted["strength"]]
    fig = go.Figure(go.Bar(
        x=df_sorted["strength"],
        y=df_sorted["sector"],
        orientation="h",
        marker_color=colors,
    ))
    fig.update_layout(
        title="Sector Strength",
        xaxis_title="Strength Score",
        height=400,
        margin=dict(l=10, r=10, t=40, b=10),
    )
    return fig

import pandas as pd

def make_candles(rows: list[dict]) -> pd.DataFrame:
    """Build a DataFrame from list of {o,h,l,c,v} dicts."""
    df = pd.DataFrame([{
        "open": r["o"], "high": r["h"], "low": r["l"],
        "close": r["c"], "volume": r.get("v", 1000000)
    } for r in rows])
    return df

import pandas as pd
from database.db import get_session
from database.models import Stock
from config.settings import STOCK_UNIVERSE_PATH

FNO_SYMBOLS = {
    "RELIANCE","TCS","HDFCBANK","INFY","ICICIBANK","HINDUNILVR","ITC","SBIN","BHARTIARTL",
    "KOTAKBANK","LT","AXISBANK","ASIANPAINT","MARUTI","TITAN","BAJFINANCE","NESTLEIND",
    "WIPRO","TECHM","HCLTECH","SUNPHARMA","ULTRACEMCO","ADANIENT","ADANIPORTS","POWERGRID",
    "NTPC","ONGC","COALINDIA","JSWSTEEL","TATASTEEL","TATAMOTORS","M&M","BAJAJFINSV",
    "GRASIM","BPCL","EICHERMOT","HEROMOTOCO","DRREDDY","DIVISLAB","CIPLA","APOLLOHOSP",
    "BRITANNIA","HINDALCO","INDUSINDBK","SBILIFE","BAJAJ-AUTO","TATACONSUM","LTIM",
    "HAL","BEL","IRFC","TRENT","ZOMATO","IRCTC","DMART",
}


def load_stock_universe(path: str | None = None) -> None:
    """Load NIFTY 500 CSV into stocks table. Safe to call multiple times."""
    csv_path = path or STOCK_UNIVERSE_PATH
    df = pd.read_csv(csv_path)
    session = get_session()
    try:
        for _, row in df.iterrows():
            symbol = str(row["Symbol"]).strip()
            existing = session.query(Stock).filter_by(symbol=symbol).first()
            if existing:
                continue
            session.add(Stock(
                symbol=symbol,
                company_name=str(row["Company Name"]).strip(),
                sector=str(row["Industry"]).strip(),
                is_fno=1 if symbol in FNO_SYMBOLS else 0,
            ))
        session.commit()
    finally:
        session.close()


def get_all_symbols() -> list[str]:
    session = get_session()
    try:
        return [r.symbol for r in session.query(Stock.symbol).all()]
    finally:
        session.close()


def get_fno_symbols() -> list[str]:
    session = get_session()
    try:
        return [r.symbol for r in session.query(Stock.symbol).filter_by(is_fno=1).all()]
    finally:
        session.close()

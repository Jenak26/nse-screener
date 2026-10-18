import logging
import time
from typing import Optional

import pandas as pd
import yfinance as yf

from backend.database.models import utcnow

logger = logging.getLogger(__name__)


def _fetch_one(symbol: str) -> Optional[dict]:
    try:
        ticker = yf.Ticker(f"{symbol}.NS")
        info = ticker.info
        if not info or (not info.get("longName") and not info.get("shortName")):
            return None

        rev_growth = None
        try:
            fin = ticker.financials
            if fin is not None and not fin.empty and fin.shape[1] >= 2:
                rev_rows = fin[fin.index.str.contains("Revenue", case=False, na=False)]
                if not rev_rows.empty:
                    latest, prev = rev_rows.iloc[0, 0], rev_rows.iloc[0, 1]
                    if prev and prev != 0:
                        rev_growth = round((latest - prev) / abs(prev) * 100, 2)
        except Exception:
            pass

        mc = info.get("marketCap")
        roe_raw = info.get("returnOnEquity")
        if roe_raw is None:
            # Yahoo omits returnOnEquity for many NSE listings; EPS / book value per share
            # is the same ratio on a per-share basis (within ~2pp of Yahoo's figure).
            eps, bvps = info.get("trailingEps"), info.get("bookValue")
            if eps is not None and bvps:
                roe_raw = eps / bvps
        # Yahoo's insider stake for NSE listings tracks the promoter group's holding;
        # used when NSE's shareholding file is unavailable.
        insiders = info.get("heldPercentInsiders")
        # Yahoo reports debt/equity as a percentage (50.0 == 0.5x); store it as a ratio.
        de_raw = info.get("debtToEquity")

        return {
            "symbol": symbol,
            "company_name": info.get("longName") or info.get("shortName") or symbol,
            "sector": info.get("sector") or info.get("industry") or "Unknown",
            "market_cap": round(mc / 1e7, 2) if mc else None,
            "pe_ratio": info.get("trailingPE"),
            "roe": round(roe_raw * 100, 2) if roe_raw is not None else None,
            "debt_to_equity": round(de_raw / 100, 3) if de_raw is not None else None,
            "revenue_growth_yoy": rev_growth,
            "promoter_holding": round(insiders * 100, 2) if insiders is not None else None,
            "current_ratio": info.get("currentRatio"),
            "price": info.get("currentPrice") or info.get("regularMarketPrice"),
            "fifty_two_week_high": info.get("fiftyTwoWeekHigh"),
            "updated_at": utcnow(),
        }
    except Exception as e:
        logger.warning(f"Failed to fetch {symbol}: {e}")
        return None


def fetch_all(symbols: list[str], batch_size: int = 10, delay: float = 1.0) -> list[dict]:
    results = []
    for i in range(0, len(symbols), batch_size):
        batch = symbols[i: i + batch_size]
        for symbol in batch:
            data = _fetch_one(symbol)
            if data:
                results.append(data)
        if i + batch_size < len(symbols):
            time.sleep(delay)
        logger.info(f"Fetched {min(i + batch_size, len(symbols))}/{len(symbols)}")
    return results


def load_symbols(csv_path: str) -> list[str]:
    df = pd.read_csv(csv_path)
    return df["Symbol"].dropna().tolist()

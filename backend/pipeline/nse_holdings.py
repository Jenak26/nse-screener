import io
import logging
import zipfile
from datetime import datetime

import pandas as pd
import requests

logger = logging.getLogger(__name__)

_QUARTER_MAP = [(3, "Mar"), (6, "Jun"), (9, "Sep"), (12, "Dec")]


def _candidate_urls() -> list[str]:
    now = datetime.now()
    urls = []
    for year_offset in range(2):
        year = now.year - year_offset
        for _, month_name in reversed(_QUARTER_MAP):
            urls.append(
                f"https://archives.nseindia.com/corporate/shp{month_name}{year}.zip"
            )
    return urls


def fetch_promoter_holdings() -> dict[str, float]:
    for url in _candidate_urls():
        try:
            resp = requests.get(
                url,
                timeout=30,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
            )
            if resp.status_code != 200:
                continue

            with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
                csv_names = [n for n in zf.namelist() if n.endswith(".csv")]
                if not csv_names:
                    continue
                df = pd.read_csv(zf.open(csv_names[0]))

            df.columns = [c.strip().upper() for c in df.columns]
            symbol_col = next((c for c in df.columns if c == "SYMBOL"), None)
            promoter_col = next(
                (c for c in df.columns if "PROMOTER" in c and "TOTAL" not in c), None
            ) or next((c for c in df.columns if "PROMOTER" in c), None)

            if not symbol_col or not promoter_col:
                logger.warning(f"Unexpected columns in {url}: {list(df.columns)}")
                continue

            df[promoter_col] = pd.to_numeric(df[promoter_col], errors="coerce")
            result = {
                str(row[symbol_col]).strip(): float(row[promoter_col])
                for _, row in df.iterrows()
                if pd.notna(row[promoter_col])
            }
            logger.info(f"Loaded promoter holdings for {len(result)} stocks from {url}")
            return result

        except Exception as e:
            logger.warning(f"Failed to load {url}: {e}")
            continue

    logger.error("Could not load NSE promoter holdings — using empty dict")
    return {}

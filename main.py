import logging
import subprocess
import sys
import time

from apscheduler.schedulers.background import BackgroundScheduler

from config.settings import validate_runtime_config
from database.db import init_db, get_session
from database.models import Candle
from backend.data_fetcher.stock_universe import load_stock_universe, get_all_symbols
from backend.data_fetcher.yfinance_client import fetch_candles
from backend.data_fetcher.angel_one import AngelOneClient
from backend.scanners.scan_runner import run_full_scan
from utils.time_utils import is_market_open

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

angel = AngelOneClient()
_angel_logged_in = False


def _try_angel_login() -> None:
    global _angel_logged_in
    try:
        angel.login()
        _angel_logged_in = True
        logger.info("Angel One login successful")
    except Exception as e:
        logger.warning(f"Angel One login failed: {e}. Using yfinance fallback.")
        _angel_logged_in = False


def _store_candles(symbol: str, timeframe: str, df) -> None:
    if df.empty:
        return
    session = get_session()
    try:
        for _, row in df.iterrows():
            existing = (
                session.query(Candle)
                .filter_by(symbol=symbol, timeframe=timeframe, timestamp=int(row["timestamp"]))
                .first()
            )
            if existing:
                continue
            session.add(Candle(
                symbol=symbol, timeframe=timeframe,
                timestamp=int(row["timestamp"]),
                open=row["open"], high=row["high"],
                low=row["low"],  close=row["close"],
                volume=int(row["volume"]),
            ))
        session.commit()
    except Exception as e:
        session.rollback()
        logger.warning(f"Store candles error {symbol}/{timeframe}: {e}")
    finally:
        session.close()


def job_fetch_and_scan(timeframes: list[str]) -> None:
    if not is_market_open():
        return
    symbols = get_all_symbols()
    for symbol in symbols:
        for tf in timeframes:
            if _angel_logged_in:
                df = angel.get_candles(symbol, tf, days=5)
            else:
                df = fetch_candles(symbol, tf, days=5)
            _store_candles(symbol, tf, df)
    run_full_scan(symbols, timeframes)
    logger.info(f"Scan complete: {timeframes}")


def job_daily_backfill() -> None:
    symbols = get_all_symbols()
    for symbol in symbols:
        for tf in ["Daily", "Weekly"]:
            df = fetch_candles(symbol, tf)
            _store_candles(symbol, tf, df)
    run_full_scan(symbols, ["Daily", "Weekly"])
    logger.info("Daily backfill and EOD scan complete")


def start_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler(timezone="Asia/Kolkata")
    scheduler.add_job(lambda: job_fetch_and_scan(["5m"]),   "cron", minute="*/5",  hour="9-15")
    scheduler.add_job(lambda: job_fetch_and_scan(["15m"]),  "cron", minute="*/15", hour="9-15")
    scheduler.add_job(lambda: job_fetch_and_scan(["1H"]),   "cron", minute="15",   hour="9-15")
    scheduler.add_job(job_daily_backfill,                   "cron", hour="18",     minute="0")
    scheduler.add_job(_try_angel_login,                     "cron", hour="9",      minute="0")
    scheduler.start()
    return scheduler


if __name__ == "__main__":
    validate_runtime_config()
    init_db()
    load_stock_universe()
    _try_angel_login()

    logger.info("Running initial data backfill...")
    job_daily_backfill()

    scheduler = start_scheduler()
    logger.info("Scheduler started. Launching Streamlit dashboard...")

    subprocess.Popen([sys.executable, "-m", "streamlit", "run", "app/main_app.py",
                      "--server.headless", "true"])

    try:
        while True:
            time.sleep(60)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        logger.info("Shutdown complete.")

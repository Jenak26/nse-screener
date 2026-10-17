import asyncio
import logging
import math
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from backend.database.models import utcnow

logger = logging.getLogger(__name__)

SNAPSHOT_METRICS = ["pe_ratio", "roe", "revenue_growth_yoy", "debt_to_equity"]

# A full run makes ~500 Yahoo requests; never let two overlap (cron + manual trigger).
_pipeline_lock = asyncio.Lock()


def _clean(val):
    """Convert numpy scalars to Python natives; replace NaN/Inf with None."""
    if hasattr(val, "item"):
        val = val.item()  # np.float64 / np.int64 → Python float/int
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    return val


def quarter_label(now: datetime) -> str:
    """Indian fiscal quarter label, e.g. October 2026 -> "Q3FY27"."""
    fy = now.year + 1 if now.month >= 4 else now.year
    q = (now.month - 4) % 12 // 3 + 1
    return f"Q{q}FY{str(fy)[2:]}"


def is_running() -> bool:
    return _pipeline_lock.locked()


def write_snapshot(session, stocks_data: list[dict], now: datetime) -> None:
    """Upsert stock rows and this quarter's history points. Caller commits."""
    from backend.database.models import MetricHistory, Stock

    label = quarter_label(now)
    existing_points = {
        (h.symbol, h.metric): h
        for h in session.query(MetricHistory).filter(MetricHistory.quarter == label)
    }

    for data in stocks_data:
        cleaned = {k: _clean(v) for k, v in data.items()}
        session.merge(Stock(**cleaned))

        for metric in SNAPSHOT_METRICS:
            val = cleaned.get(metric)
            if val is None:
                continue
            point = existing_points.get((cleaned["symbol"], metric))
            if point:
                point.value, point.recorded_at = val, now
            else:
                session.add(MetricHistory(symbol=cleaned["symbol"], metric=metric,
                                          value=val, quarter=label, recorded_at=now))


async def run_pipeline() -> None:
    if _pipeline_lock.locked():
        logger.info("Pipeline already running; skipping")
        return

    async with _pipeline_lock:
        from backend.config.settings import settings
        from backend.database.db import SessionLocal
        from backend.pipeline.fetcher import fetch_all, load_symbols
        from backend.pipeline.nse_holdings import fetch_promoter_holdings

        logger.info("Daily pipeline started")
        try:
            loop = asyncio.get_running_loop()
            symbols = await loop.run_in_executor(None, load_symbols, settings.stock_universe_path)
            promoter_map = await loop.run_in_executor(None, fetch_promoter_holdings)
            stocks_data = await loop.run_in_executor(None, fetch_all, symbols)

            # Yahoo throttles datacenter IPs; a mostly-empty fetch must not wipe good data.
            if len(stocks_data) < len(symbols) * 0.5:
                logger.error(f"Fetched only {len(stocks_data)}/{len(symbols)} stocks; keeping existing data")
                return

            for data in stocks_data:
                data["promoter_holding"] = promoter_map.get(data["symbol"], data.get("promoter_holding"))

            session = SessionLocal()
            try:
                write_snapshot(session, stocks_data, utcnow())
                session.commit()
                logger.info(f"Pipeline complete: upserted {len(stocks_data)} stocks")
            except Exception:
                logger.exception("Pipeline DB write failed — rolling back")
                session.rollback()
            finally:
                session.close()
        except Exception:
            logger.exception("Pipeline failed")


def needs_refresh(last_updated: datetime | None, max_age: timedelta = timedelta(hours=24)) -> bool:
    return last_updated is None or utcnow() - last_updated > max_age


def create_scheduler(hour: int = 6, minute: int = 30) -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        run_pipeline,
        CronTrigger(hour=hour, minute=minute, timezone=ZoneInfo("Asia/Kolkata")),
        id="daily_pipeline",
        replace_existing=True,
    )
    return scheduler

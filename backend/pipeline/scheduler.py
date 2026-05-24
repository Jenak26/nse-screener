import asyncio
import logging
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)


import math


def _clean(val):
    """Replace NaN/Inf with None — PostgreSQL rejects IEEE special floats."""
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    return val


async def run_pipeline() -> None:
    from backend.config.settings import settings
    from backend.database.db import SessionLocal
    from backend.database.models import MetricHistory, Stock
    from backend.pipeline.fetcher import fetch_all, load_symbols
    from backend.pipeline.nse_holdings import fetch_promoter_holdings
    from datetime import datetime as _dt

    logger.info("Daily pipeline started")
    try:
        loop = asyncio.get_running_loop()

        symbols = await loop.run_in_executor(None, load_symbols, settings.stock_universe_path)
        promoter_map = await loop.run_in_executor(None, fetch_promoter_holdings)
        stocks_data = await loop.run_in_executor(None, fetch_all, symbols)

        now = _dt.utcnow()
        quarter_map = {1: "Q3", 2: "Q3", 3: "Q3", 4: "Q4", 5: "Q4", 6: "Q4",
                       7: "Q1", 8: "Q1", 9: "Q1", 10: "Q2", 11: "Q2", 12: "Q2"}
        fy = now.year + 1 if now.month >= 4 else now.year
        quarter_label = f"{quarter_map[now.month]}FY{str(fy)[2:]}"
        snapshot_metrics = ["pe_ratio", "roe", "revenue_growth_yoy", "debt_to_equity"]

        session = SessionLocal()
        try:
            for data in stocks_data:
                data["promoter_holding"] = promoter_map.get(data["symbol"])
                # Sanitize all float values before writing to PostgreSQL
                cleaned = {k: _clean(v) for k, v in data.items()}
                existing = session.get(Stock, cleaned["symbol"])
                if existing:
                    for k, v in cleaned.items():
                        setattr(existing, k, v)
                else:
                    session.add(Stock(**cleaned))

            for data in stocks_data:
                for metric in snapshot_metrics:
                    val = _clean(data.get(metric))
                    if val is not None:
                        session.add(MetricHistory(
                            symbol=data["symbol"],
                            metric=metric,
                            value=val,
                            quarter=quarter_label,
                            recorded_at=_dt.utcnow(),
                        ))

            session.commit()
            logger.info(f"Pipeline complete: upserted {len(stocks_data)} stocks")
        except Exception:
            logger.exception("Pipeline DB write failed — rolling back")
            session.rollback()
            raise
        finally:
            session.close()
    except Exception:
        logger.exception("Pipeline failed")


def create_scheduler(hour: int = 6, minute: int = 30) -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        run_pipeline,
        CronTrigger(hour=hour, minute=minute, timezone=ZoneInfo("Asia/Kolkata")),
        id="daily_pipeline",
        replace_existing=True,
    )
    return scheduler

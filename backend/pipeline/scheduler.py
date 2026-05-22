import asyncio
import logging
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)


async def run_pipeline() -> None:
    from backend.config.settings import settings
    from backend.database.db import SessionLocal
    from backend.database.models import Stock
    from backend.pipeline.fetcher import fetch_all, load_symbols
    from backend.pipeline.nse_holdings import fetch_promoter_holdings

    logger.info("Daily pipeline started")
    loop = asyncio.get_event_loop()

    symbols = await loop.run_in_executor(None, load_symbols, settings.stock_universe_path)
    promoter_map = await loop.run_in_executor(None, fetch_promoter_holdings)
    stocks_data = await loop.run_in_executor(None, fetch_all, symbols)

    session = SessionLocal()
    try:
        for data in stocks_data:
            data["promoter_holding"] = promoter_map.get(data["symbol"])
            existing = session.get(Stock, data["symbol"])
            if existing:
                for k, v in data.items():
                    setattr(existing, k, v)
            else:
                session.add(Stock(**data))
        session.commit()
        logger.info(f"Pipeline complete: upserted {len(stocks_data)} stocks")
    finally:
        session.close()


def create_scheduler(hour: int = 6, minute: int = 30) -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        run_pipeline,
        CronTrigger(hour=hour, minute=minute, timezone=ZoneInfo("Asia/Kolkata")),
        id="daily_pipeline",
        replace_existing=True,
    )
    return scheduler

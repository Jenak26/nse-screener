"""Committed CSV snapshot of the database.

Free hosting wipes the disk on every restart, so the deployed API boots from
data/seed_*.csv. A daily GitHub Action runs the pipeline and commits a fresh
snapshot (`python -m backend.pipeline.seed refresh`), which triggers a redeploy.
"""
import asyncio
import csv
import logging
import os
import sys
import tempfile
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.database.models import MetricHistory, Stock

logger = logging.getLogger(__name__)

STOCK_COLS = [c.key for c in Stock.__table__.columns]
HISTORY_COLS = ["symbol", "metric", "value", "quarter", "recorded_at"]
_FLOAT_COLS = {
    "market_cap", "pe_ratio", "roe", "debt_to_equity", "revenue_growth_yoy",
    "promoter_holding", "current_ratio", "price", "fifty_two_week_high", "value",
}
_DATETIME_COLS = {"updated_at", "recorded_at"}


def history_path_for(stocks_path: str) -> str:
    return os.path.join(os.path.dirname(stocks_path), "seed_history.csv")


def _parse(col: str, raw: str):
    if raw == "":
        return None
    if col in _FLOAT_COLS:
        return float(raw)
    if col in _DATETIME_COLS:
        return datetime.fromisoformat(raw)
    return raw


def _read(path: str) -> list[dict]:
    try:
        with open(path, newline="", encoding="utf-8") as f:
            return [{k: _parse(k, v) for k, v in r.items()} for r in csv.DictReader(f)]
    except FileNotFoundError:
        return []


def seed_if_empty(session: Session, csv_path: str) -> int:
    """Load the committed snapshot into an empty DB so a fresh deploy never serves
    a blank screener."""
    if session.scalar(select(func.count()).select_from(Stock)):
        return 0
    stocks = _read(csv_path)
    if not stocks:
        logger.warning(f"No seed snapshot at {csv_path}")
        return 0
    session.add_all(Stock(**r) for r in stocks)
    session.add_all(MetricHistory(**r) for r in _read(history_path_for(csv_path)))
    session.commit()
    logger.info(f"Seeded {len(stocks)} stocks from {csv_path}")
    return len(stocks)


def export_snapshot(session: Session, csv_path: str) -> None:
    def write(path, cols, rows):
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f, lineterminator="\n")
            w.writerow(cols)
            for r in rows:
                w.writerow("" if getattr(r, c) is None else getattr(r, c) for c in cols)

    write(csv_path, STOCK_COLS, session.scalars(select(Stock).order_by(Stock.symbol)))
    write(history_path_for(csv_path), HISTORY_COLS, session.scalars(
        select(MetricHistory).order_by(MetricHistory.symbol, MetricHistory.metric, MetricHistory.quarter)
    ))


def refresh(csv_path: str) -> bool:
    """Seed a scratch DB from the snapshot, run the live pipeline, write it back.
    Returns False (snapshot untouched) if the fetch came back mostly empty."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from backend.database.models import Base
    from backend.pipeline import scheduler

    with tempfile.TemporaryDirectory() as tmp:
        engine = create_engine(f"sqlite:///{tmp}/refresh.db")
        Base.metadata.create_all(engine)
        SessionLocal = sessionmaker(bind=engine)
        with SessionLocal() as s:
            seed_if_empty(s, csv_path)
            before = s.scalar(select(func.max(Stock.updated_at)))

        import backend.database.db as db
        db.SessionLocal = SessionLocal  # point the pipeline at the scratch DB
        asyncio.run(scheduler.run_pipeline())

        with SessionLocal() as s:
            if s.scalar(select(func.max(Stock.updated_at))) == before:
                logger.error("Pipeline did not update any rows; snapshot unchanged")
                return False
            export_snapshot(s, csv_path)
        engine.dispose()
    return True


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    logging.getLogger("yfinance").setLevel(logging.CRITICAL)
    if sys.argv[1:] != ["refresh"]:
        sys.exit("usage: python -m backend.pipeline.seed refresh")
    from backend.config.settings import settings

    sys.exit(0 if refresh(settings.seed_path) else 1)

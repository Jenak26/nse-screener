import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.routes import sectors, stocks
from backend.config.settings import settings
from backend.database.db import init_db
from backend.pipeline.scheduler import create_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    scheduler = create_scheduler(settings.pipeline_run_hour, settings.pipeline_run_minute)
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(title="NSE Stock Screener API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(stocks.router, prefix="/api")
app.include_router(sectors.router, prefix="/api")


@app.post("/api/admin/run-pipeline")
async def trigger_pipeline():
    from backend.pipeline.scheduler import run_pipeline
    import asyncio
    asyncio.create_task(run_pipeline())
    return {"status": "pipeline started"}


@app.get("/api/admin/test-pipeline")
async def test_pipeline():
    """Run pipeline on 5 stocks synchronously and return result for debugging."""
    import math
    from backend.config.settings import settings
    from backend.database.db import SessionLocal
    from backend.database.models import Stock
    from backend.pipeline.fetcher import fetch_all, load_symbols
    import asyncio

    loop = asyncio.get_running_loop()
    try:
        all_symbols = await loop.run_in_executor(None, load_symbols, settings.stock_universe_path)
        symbols = all_symbols[:5]
        stocks_data = await loop.run_in_executor(None, fetch_all, symbols)

        def clean(v):
            if hasattr(v, "item"):
                v = v.item()
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                return None
            return v

        session = SessionLocal()
        try:
            for data in stocks_data:
                cleaned = {k: clean(v) for k, v in data.items()}
                existing = session.get(Stock, cleaned["symbol"])
                if existing:
                    for k, v in cleaned.items():
                        setattr(existing, k, v)
                else:
                    session.add(Stock(**cleaned))
            session.commit()
            count = session.execute(__import__("sqlalchemy").text("SELECT COUNT(*) FROM stocks")).scalar()
            return {"status": "ok", "fetched": len(stocks_data), "db_count": count, "sample": stocks_data[:1]}
        except Exception as e:
            session.rollback()
            return {"status": "db_error", "error": str(e), "fetched": len(stocks_data)}
        finally:
            session.close()
    except Exception as e:
        return {"status": "fetch_error", "error": str(e)}

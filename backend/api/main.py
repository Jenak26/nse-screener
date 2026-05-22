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
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(stocks.router, prefix="/api")
app.include_router(sectors.router, prefix="/api")

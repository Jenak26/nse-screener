import asyncio
import logging
import secrets
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from backend.api.routes import sectors, stocks
from backend.config.settings import settings
from backend.database.db import SessionLocal, init_db
from backend.database.queries import get_last_updated_dt
from backend.pipeline.scheduler import create_scheduler, needs_refresh, run_pipeline
from backend.pipeline.seed import seed_if_empty

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


def _bootstrap() -> bool:
    """Create tables, seed an empty DB, and report whether the data is stale."""
    init_db()
    session = SessionLocal()
    try:
        seed_if_empty(session, settings.seed_path)
        return needs_refresh(get_last_updated_dt(session))
    finally:
        session.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    stale = False
    try:
        stale = _bootstrap()
    except Exception:
        logger.exception("DB bootstrap failed on startup")

    scheduler = None
    if settings.scheduler_enabled:
        scheduler = create_scheduler(settings.pipeline_run_hour, settings.pipeline_run_minute)
        scheduler.start()
    if stale and settings.refresh_on_startup:
        # Serve the snapshot immediately; refresh it in the background.
        asyncio.create_task(run_pipeline())
    yield
    if scheduler:
        scheduler.shutdown()


app = FastAPI(title="NSE Stock Screener API", version="1.1.0", lifespan=lifespan)

app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(stocks.router, prefix="/api")
app.include_router(sectors.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}


def require_admin(x_admin_token: str = Header(default="")):
    # Unset token disables admin routes entirely rather than leaving them open.
    if not settings.admin_token or not secrets.compare_digest(x_admin_token, settings.admin_token):
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.post("/api/admin/run-pipeline", dependencies=[Depends(require_admin)])
async def trigger_pipeline():
    from backend.pipeline.scheduler import is_running

    if is_running():
        return {"status": "already running"}
    asyncio.create_task(run_pipeline())
    return {"status": "pipeline started"}

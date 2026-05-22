from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.api.schemas import MetaOut, SectorOut
from backend.database.db import get_session
from backend.database.models import Stock
from backend.database.queries import get_last_updated, get_sector_stats

router = APIRouter()


@router.get("/sectors", response_model=list[SectorOut])
def list_sectors(session: Session = Depends(get_session)):
    return get_sector_stats(session)


@router.get("/meta", response_model=MetaOut)
def get_meta(session: Session = Depends(get_session)):
    total = session.scalar(select(func.count()).select_from(Stock)) or 0
    last_updated = get_last_updated(session)
    return MetaOut(
        last_updated=last_updated,
        total_stocks=total,
        pipeline_status="ok" if total > 0 else "empty",
    )

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database.models import Base
from config.settings import DB_PATH
import os

def _get_database_url() -> str:
    pg_url = os.getenv("DATABASE_URL", "")
    if pg_url:
        return pg_url
    return f"sqlite:///{DB_PATH}"

_url = _get_database_url()
_connect_args = {"check_same_thread": False} if _url.startswith("sqlite") else {}
engine = create_engine(_url, echo=False, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine)

def init_db():
    Base.metadata.create_all(engine)

def get_session():
    return SessionLocal()

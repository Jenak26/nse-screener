from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from backend.database.models import Base
from backend.config.settings import settings

_connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, echo=False, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def init_db():
    Base.metadata.create_all(engine)
    # create_all skips tables that already exist, so bring older databases up to date:
    # collapse the duplicate daily history rows, then add any missing indexes.
    with engine.begin() as conn:
        conn.execute(text(
            "DELETE FROM metric_history WHERE id NOT IN "
            "(SELECT MAX(id) FROM metric_history GROUP BY symbol, metric, quarter)"
        ))
        for table in Base.metadata.sorted_tables:
            for index in table.indexes:
                index.create(conn, checkfirst=True)


def get_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

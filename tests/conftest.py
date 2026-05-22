import pytest
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database.models import Base, Stock


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    session.add_all([
        Stock(symbol="RELIANCE", company_name="Reliance Industries", sector="Energy",
              market_cap=1500000.0, pe_ratio=22.5, roe=12.5, debt_to_equity=0.5,
              revenue_growth_yoy=15.0, promoter_holding=50.0, updated_at=datetime.utcnow()),
        Stock(symbol="TCS", company_name="Tata Consultancy Services", sector="Technology",
              market_cap=1200000.0, pe_ratio=28.0, roe=40.0, debt_to_equity=0.0,
              revenue_growth_yoy=10.0, promoter_holding=72.0, updated_at=datetime.utcnow()),
        Stock(symbol="HDFCBANK", company_name="HDFC Bank", sector="Financial Services",
              market_cap=800000.0, pe_ratio=18.0, roe=18.0, debt_to_equity=1.2,
              revenue_growth_yoy=20.0, promoter_holding=26.0, updated_at=datetime.utcnow()),
    ])
    session.commit()
    yield session
    session.close()

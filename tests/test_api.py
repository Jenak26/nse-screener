from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.api.main import app
from backend.database.db import get_session
from backend.database.models import Base, Stock

TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
Base.metadata.create_all(TEST_ENGINE)
TestSession = sessionmaker(bind=TEST_ENGINE)


def override_session():
    s = TestSession()
    try:
        yield s
    finally:
        s.close()


app.dependency_overrides[get_session] = override_session


@pytest.fixture(autouse=True)
def seed():
    session = TestSession()
    session.query(Stock).delete()
    session.add_all([
        Stock(symbol="RELIANCE", company_name="Reliance Industries", sector="Energy",
              market_cap=1500000.0, pe_ratio=22.5, roe=12.5, updated_at=datetime.utcnow()),
        Stock(symbol="TCS", company_name="TCS", sector="Technology",
              market_cap=1200000.0, pe_ratio=28.0, roe=40.0, updated_at=datetime.utcnow()),
    ])
    session.commit()
    session.close()


@pytest.fixture(scope="module")
def client():
    with patch("backend.api.main.create_scheduler", return_value=MagicMock()):
        with TestClient(app) as c:
            yield c


def test_list_stocks_returns_200(client):
    resp = client.get("/api/stocks")
    assert resp.status_code == 200
    body = resp.json()
    assert "stocks" in body
    assert "total" in body
    assert body["total"] == 2


def test_list_stocks_sector_filter(client):
    resp = client.get("/api/stocks?sector=Technology")
    assert resp.status_code == 200
    stocks = resp.json()["stocks"]
    assert len(stocks) == 1
    assert stocks[0]["symbol"] == "TCS"


def test_list_stocks_pe_max_filter(client):
    resp = client.get("/api/stocks?pe_max=25")
    assert resp.status_code == 200
    for s in resp.json()["stocks"]:
        assert s["pe_ratio"] <= 25


def test_get_stock_detail(client):
    resp = client.get("/api/stocks/RELIANCE")
    assert resp.status_code == 200
    body = resp.json()
    assert body["symbol"] == "RELIANCE"
    assert "sector_rank" in body


def test_get_stock_not_found(client):
    resp = client.get("/api/stocks/NOTEXIST")
    assert resp.status_code == 404


def test_list_sectors(client):
    resp = client.get("/api/sectors")
    assert resp.status_code == 200
    sectors = [s["sector"] for s in resp.json()]
    assert "Energy" in sectors


def test_get_meta(client):
    resp = client.get("/api/meta")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_stocks"] == 2
    assert body["pipeline_status"] == "ok"

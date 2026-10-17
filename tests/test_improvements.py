from datetime import datetime, timedelta

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from backend.database.models import Base, MetricHistory, Stock
from backend.database.queries import get_metric_history, get_stocks
from backend.pipeline.scheduler import needs_refresh, quarter_label, write_snapshot
from backend.pipeline.seed import seed_if_empty


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return engine, sessionmaker(bind=engine)()


def test_get_stocks_uses_a_single_round_trip(db_session):
    statements = []
    engine = db_session.get_bind()
    listener = lambda *args: statements.append(args[2])
    event.listen(engine, "before_cursor_execute", listener)
    try:
        stocks, total = get_stocks(db_session, roe_min=15.0, sort_by="roe")
    finally:
        event.remove(engine, "before_cursor_execute", listener)
    assert len(statements) == 1
    assert total == 2
    assert [s.symbol for s in stocks] == ["TCS", "HDFCBANK"]


def test_get_stocks_total_is_full_match_count_not_page_size(db_session):
    stocks, total = get_stocks(db_session, page=1, page_size=1)
    assert len(stocks) == 1
    assert total == 3


def test_get_stocks_page_past_end_still_reports_total(db_session):
    stocks, total = get_stocks(db_session, page=5, page_size=2)
    assert stocks == []
    assert total == 3


def test_quarter_label_follows_indian_fiscal_year():
    assert quarter_label(datetime(2026, 4, 1)) == "Q1FY27"
    assert quarter_label(datetime(2026, 9, 30)) == "Q2FY27"
    assert quarter_label(datetime(2026, 10, 17)) == "Q3FY27"
    assert quarter_label(datetime(2027, 2, 1)) == "Q4FY27"


def test_daily_runs_keep_one_history_point_per_quarter():
    _, session = _session()
    row = {"symbol": "TCS", "company_name": "TCS", "roe": 40.0, "pe_ratio": 28.0}
    write_snapshot(session, [row], datetime(2026, 10, 1))
    session.commit()
    write_snapshot(session, [{**row, "roe": 41.0}], datetime(2026, 10, 2))
    session.commit()

    points = session.query(MetricHistory).filter_by(symbol="TCS", metric="roe").all()
    assert len(points) == 1
    assert points[0].value == 41.0
    assert session.get(Stock, "TCS").roe == 41.0


def test_metric_history_returns_latest_eight_oldest_first():
    _, session = _session()
    base = datetime(2024, 1, 1)
    for i in range(10):
        session.add(MetricHistory(symbol="TCS", metric="roe", value=float(i),
                                  quarter=f"Q{i}", recorded_at=base + timedelta(days=90 * i)))
    session.commit()

    history = get_metric_history(session, "TCS", ["roe", "pe_ratio"])
    assert [p["value"] for p in history["roe"]] == [2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0]
    assert history["pe_ratio"] == []


def test_seed_loads_only_into_empty_db(tmp_path):
    csv_path = tmp_path / "seed.csv"
    csv_path.write_text(
        "symbol,company_name,sector,market_cap,pe_ratio,roe,debt_to_equity,revenue_growth_yoy,"
        "promoter_holding,current_ratio,price,fifty_two_week_high,updated_at\n"
        "TCS,TCS,Technology,1200000,28.0,40.0,,10.0,72.0,,3500,4000,2026-05-22 12:59:52\n",
        encoding="utf-8",
    )
    _, session = _session()
    assert seed_if_empty(session, str(csv_path)) == 1
    assert session.get(Stock, "TCS").debt_to_equity is None
    assert seed_if_empty(session, str(csv_path)) == 0


def test_needs_refresh():
    assert needs_refresh(None)
    assert needs_refresh(datetime(2020, 1, 1))
    assert not needs_refresh(datetime.utcnow())


def test_snapshot_round_trip_keeps_stocks_and_history(tmp_path):
    from backend.pipeline.seed import export_snapshot

    _, src = _session()
    write_snapshot(src, [{"symbol": "TCS", "company_name": "TCS", "roe": 40.0,
                          "updated_at": datetime(2026, 10, 1)}], datetime(2026, 10, 1))
    src.commit()
    path = tmp_path / "seed_stocks.csv"
    export_snapshot(src, str(path))

    _, dst = _session()
    assert seed_if_empty(dst, str(path)) == 1
    assert dst.get(Stock, "TCS").roe == 40.0
    point = dst.query(MetricHistory).one()
    assert (point.metric, point.quarter, point.value) == ("roe", "Q3FY27", 40.0)

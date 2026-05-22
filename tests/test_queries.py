from backend.database.queries import get_stocks, get_sector_stats, get_last_updated, get_distinct_sectors


def test_get_stocks_no_filters_returns_all(db_session):
    stocks, total = get_stocks(db_session)
    assert total == 3
    assert len(stocks) == 3


def test_get_stocks_sector_filter(db_session):
    stocks, total = get_stocks(db_session, sector="Technology")
    assert total == 1
    assert stocks[0].symbol == "TCS"


def test_get_stocks_pe_max_filter(db_session):
    stocks, total = get_stocks(db_session, pe_max=20.0)
    assert all(s.pe_ratio <= 20.0 for s in stocks)


def test_get_stocks_roe_min_filter(db_session):
    stocks, total = get_stocks(db_session, roe_min=15.0)
    assert all(s.roe >= 15.0 for s in stocks)


def test_get_stocks_sort_by_roe_desc(db_session):
    stocks, _ = get_stocks(db_session, sort_by="roe", sort_dir="desc", page_size=10)
    roes = [s.roe for s in stocks if s.roe is not None]
    assert roes == sorted(roes, reverse=True)


def test_get_stocks_pagination(db_session):
    stocks_p1, total = get_stocks(db_session, page=1, page_size=2)
    stocks_p2, _ = get_stocks(db_session, page=2, page_size=2)
    assert len(stocks_p1) == 2
    assert len(stocks_p2) == 1
    assert total == 3


def test_get_sector_stats(db_session):
    stats = get_sector_stats(db_session)
    sectors = [s["sector"] for s in stats]
    assert "Technology" in sectors


def test_get_last_updated(db_session):
    result = get_last_updated(db_session)
    assert result is not None


def test_get_distinct_sectors(db_session):
    sectors = get_distinct_sectors(db_session)
    assert "Technology" in sectors
    assert "Energy" in sectors

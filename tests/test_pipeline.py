import io
import zipfile
from unittest.mock import MagicMock, patch

import pytest

from backend.pipeline.fetcher import _fetch_one, fetch_all, load_symbols


def make_ticker_mock(info: dict, financials=None):
    mock = MagicMock()
    mock.info = info
    mock.financials = financials
    return mock


def test_fetch_one_returns_dict_on_valid_data():
    info = {
        "longName": "Reliance Industries",
        "sector": "Energy",
        "marketCap": 15_000_000_000_00,
        "trailingPE": 22.5,
        "returnOnEquity": 0.125,
        "debtToEquity": 50.0,
        "currentRatio": 1.2,
        "currentPrice": 2850.0,
        "fiftyTwoWeekHigh": 3100.0,
    }
    with patch("yfinance.Ticker", return_value=make_ticker_mock(info)):
        result = _fetch_one("RELIANCE")
    assert result is not None
    assert result["symbol"] == "RELIANCE"
    assert result["company_name"] == "Reliance Industries"
    assert result["sector"] == "Energy"
    assert result["roe"] == pytest.approx(12.5, 0.1)


def test_fetch_one_returns_none_on_empty_info():
    with patch("yfinance.Ticker", return_value=make_ticker_mock({})):
        result = _fetch_one("BADTICKER")
    assert result is None


def test_fetch_one_handles_exception():
    with patch("yfinance.Ticker", side_effect=Exception("Network error")):
        result = _fetch_one("RELIANCE")
    assert result is None


def test_fetch_all_returns_list_of_valid_results():
    with patch("backend.pipeline.fetcher._fetch_one", return_value={"symbol": "TEST", "company_name": "Test"}):
        results = fetch_all(["TEST", "TEST2"], batch_size=2, delay=0)
    assert len(results) == 2


def test_load_symbols_reads_csv(tmp_path):
    csv = tmp_path / "test.csv"
    csv.write_text("Company Name,Industry,Symbol,Series,ISIN Code\nTest Corp,IT,TESTCORP,EQ,INE001\n")
    symbols = load_symbols(str(csv))
    assert symbols == ["TESTCORP"]


# --- NSE holdings tests ---

from backend.pipeline.nse_holdings import fetch_promoter_holdings


def make_zip_csv(content: str) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("shpDec2024.csv", content)
    return buf.getvalue()


def test_fetch_promoter_holdings_parses_csv():
    csv = "SYMBOL,PROMOTER AND PROMOTER GROUP,PUBLIC\nRELIANCE,50.1,49.9\nTCS,72.0,28.0\n"
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.content = make_zip_csv(csv)

    with patch("requests.get", return_value=mock_resp):
        result = fetch_promoter_holdings()

    assert result.get("RELIANCE") == pytest.approx(50.1, 0.01)
    assert result.get("TCS") == pytest.approx(72.0, 0.01)


def test_fetch_promoter_holdings_returns_empty_on_failure():
    with patch("requests.get", side_effect=Exception("timeout")):
        result = fetch_promoter_holdings()
    assert result == {}

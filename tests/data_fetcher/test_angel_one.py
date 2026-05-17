import pytest
from unittest.mock import patch, MagicMock
from backend.data_fetcher.angel_one import AngelOneClient, INTERVAL_MAP

@pytest.fixture
def mock_client():
    with patch("backend.data_fetcher.angel_one.SmartConnect") as MockSC:
        instance = MockSC.return_value
        instance.generateSession.return_value = {
            "data": {"jwtToken": "fake_jwt", "feedToken": "fake_feed"}
        }
        with patch("backend.data_fetcher.angel_one.pyotp") as mock_pyotp:
            mock_pyotp.TOTP.return_value.now.return_value = "123456"
            client = AngelOneClient(
                api_key="test_key", client_id="test_client",
                password="test_pass", totp_secret="BASE32SECRET3232"
            )
            client.login()
        yield client, instance

def test_login_sets_auth_token(mock_client):
    client, _ = mock_client
    assert client.auth_token == "fake_jwt"
    assert client.feed_token == "fake_feed"

def test_get_candles_returns_dataframe(mock_client):
    import pandas as pd
    client, api = mock_client
    api.getCandleData.return_value = {
        "status": True,
        "data": [
            ["2024-01-15T09:15:00+05:30", 100.0, 105.0, 98.0, 103.0, 1000000],
            ["2024-01-15T09:20:00+05:30", 103.0, 108.0, 101.0, 106.0, 1200000],
        ]
    }
    client._token_map = {"RELIANCE": "2885"}
    df = client.get_candles("RELIANCE", "15m", days=1)
    assert isinstance(df, pd.DataFrame)
    assert len(df) == 2
    assert "close" in df.columns
    assert "timestamp" in df.columns

def test_get_candles_returns_empty_for_unknown_symbol(mock_client):
    import pandas as pd
    client, _ = mock_client
    client._token_map = {}
    df = client.get_candles("UNKNOWN", "Daily", days=5)
    assert df.empty

def test_get_candles_returns_empty_on_api_error(mock_client):
    import pandas as pd
    client, api = mock_client
    client._token_map = {"TCS": "11536"}
    api.getCandleData.return_value = {"status": False, "data": None}
    df = client.get_candles("TCS", "Daily", days=5)
    assert df.empty

def test_interval_map_has_required_timeframes():
    assert "5m" in INTERVAL_MAP
    assert "15m" in INTERVAL_MAP
    assert "1H" in INTERVAL_MAP
    assert "Daily" in INTERVAL_MAP

import pyotp
import pandas as pd
import requests
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from SmartApi import SmartConnect
from config.settings import ANGEL_API_KEY, ANGEL_CLIENT_ID, ANGEL_PASSWORD, ANGEL_TOTP_SECRET

IST = ZoneInfo("Asia/Kolkata")

INTERVAL_MAP = {
    "5m":    "FIVE_MINUTE",
    "15m":   "FIFTEEN_MINUTE",
    "1H":    "ONE_HOUR",
    "Daily": "ONE_DAY",
    "Weekly":"ONE_DAY",
}

INSTRUMENTS_URL = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json"


class AngelOneClient:
    def __init__(self, api_key: str = ANGEL_API_KEY, client_id: str = ANGEL_CLIENT_ID,
                 password: str = ANGEL_PASSWORD, totp_secret: str = ANGEL_TOTP_SECRET):
        self._api = SmartConnect(api_key=api_key)
        self._client_id = client_id
        self._password = password
        self._totp_secret = totp_secret
        self.auth_token: str = ""
        self.feed_token: str = ""
        self._token_map: dict[str, str] = {}

    def login(self) -> None:
        totp = pyotp.TOTP(self._totp_secret).now()
        data = self._api.generateSession(self._client_id, self._password, totp)
        self.auth_token = data["data"]["jwtToken"]
        self.feed_token = data["data"]["feedToken"]
        self._load_token_map()

    def _load_token_map(self) -> None:
        """Download Angel One instrument master and build symbol->token map for NSE EQ."""
        try:
            resp = requests.get(INSTRUMENTS_URL, timeout=30)
            instruments = resp.json()
            self._token_map = {
                i["symbol"]: i["token"]
                for i in instruments
                if i.get("exch_seg") == "NSE" and i.get("instrumenttype") == ""
            }
        except Exception:
            self._token_map = {}

    def get_candles(self, symbol: str, timeframe: str, days: int = 5) -> pd.DataFrame:
        token = self._token_map.get(symbol, "")
        if not token:
            return pd.DataFrame()

        interval = INTERVAL_MAP.get(timeframe, "ONE_DAY")
        now = datetime.now(IST)
        from_dt = now - timedelta(days=days)
        params = {
            "exchange": "NSE",
            "symboltoken": token,
            "interval": interval,
            "fromdate": from_dt.strftime("%Y-%m-%d %H:%M"),
            "todate": now.strftime("%Y-%m-%d %H:%M"),
        }
        try:
            resp = self._api.getCandleData(params)
            if not resp.get("status") or not resp.get("data"):
                return pd.DataFrame()
            rows = resp["data"]
            df = pd.DataFrame(rows, columns=["dt", "open", "high", "low", "close", "volume"])
            df["timestamp"] = pd.to_datetime(df["dt"]).astype(int) // 10**9
            df = df.drop(columns=["dt"])
            return df
        except Exception:
            return pd.DataFrame()

    def get_ltp(self, symbols: list[str]) -> dict[str, float]:
        """Return {symbol: last_traded_price} for given symbols."""
        result: dict[str, float] = {}
        try:
            tokens = [
                {"exchange": "NSE", "symboltoken": self._token_map[s], "tradingsymbol": s}
                for s in symbols if s in self._token_map
            ]
            if not tokens:
                return result
            resp = self._api.getMarketData("LTP", tokens)
            for item in resp.get("data", {}).get("fetched", []):
                result[item["tradingSymbol"]] = float(item["ltp"])
        except Exception:
            pass
        return result

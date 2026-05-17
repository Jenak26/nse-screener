from dotenv import load_dotenv
import os

load_dotenv()

ANGEL_API_KEY: str = os.getenv("ANGEL_API_KEY", "")
ANGEL_CLIENT_ID: str = os.getenv("ANGEL_CLIENT_ID", "")
ANGEL_PASSWORD: str = os.getenv("ANGEL_PASSWORD", "")
ANGEL_TOTP_SECRET: str = os.getenv("ANGEL_TOTP_SECRET", "")
TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID: str = os.getenv("TELEGRAM_CHAT_ID", "")
ALERT_MIN_CONFIDENCE: int = int(os.getenv("ALERT_MIN_CONFIDENCE", "70"))
DB_PATH: str = os.getenv("DB_PATH", "tradad.db")
STOCK_UNIVERSE_PATH: str = os.getenv("STOCK_UNIVERSE_PATH", "data/nifty500.csv")
CANDLE_RETENTION_DAYS_INTRADAY: int = int(os.getenv("CANDLE_RETENTION_DAYS_INTRADAY", "30"))
CANDLE_RETENTION_DAYS_DAILY: int = int(os.getenv("CANDLE_RETENTION_DAYS_DAILY", "365"))

REQUIRED_AT_RUNTIME = ["ANGEL_API_KEY", "ANGEL_CLIENT_ID", "ANGEL_PASSWORD", "ANGEL_TOTP_SECRET"]

def validate_runtime_config():
    """Call this at startup. Raises ValueError if required secrets are missing."""
    missing = [k for k in REQUIRED_AT_RUNTIME if not os.getenv(k)]
    if missing:
        raise ValueError(
            f"Missing required environment variables: {', '.join(missing)}\n"
            f"Copy .env.example to .env and fill in your credentials."
        )

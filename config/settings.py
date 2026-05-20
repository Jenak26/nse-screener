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

def validate_runtime_config():
    """Warn if optional Telegram credentials are missing (alerts will be silently skipped)."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        import logging
        logging.getLogger(__name__).warning(
            "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — Telegram alerts disabled."
        )

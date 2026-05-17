from dotenv import load_dotenv
import os

load_dotenv()

ANGEL_API_KEY = os.getenv("ANGEL_API_KEY", "")
ANGEL_CLIENT_ID = os.getenv("ANGEL_CLIENT_ID", "")
ANGEL_PASSWORD = os.getenv("ANGEL_PASSWORD", "")
ANGEL_TOTP_SECRET = os.getenv("ANGEL_TOTP_SECRET", "")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
ALERT_MIN_CONFIDENCE = int(os.getenv("ALERT_MIN_CONFIDENCE", "70"))
DB_PATH = os.getenv("DB_PATH", "tradad.db")
STOCK_UNIVERSE_PATH = os.getenv("STOCK_UNIVERSE_PATH", "data/nifty500.csv")
CANDLE_RETENTION_DAYS_INTRADAY = int(os.getenv("CANDLE_RETENTION_DAYS_INTRADAY", "30"))
CANDLE_RETENTION_DAYS_DAILY = int(os.getenv("CANDLE_RETENTION_DAYS_DAILY", "365"))

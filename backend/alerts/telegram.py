import time
import logging
import asyncio
import telegram
from database.db import get_session
from database.models import Alert
from config.settings import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, ALERT_MIN_CONFIDENCE

logger = logging.getLogger(__name__)
DEDUP_WINDOW_SECONDS = 3600  # 1 hour


def is_duplicate_alert(symbol: str, pattern_name: str, timeframe: str) -> bool:
    alert_type = f"{pattern_name}|{timeframe}"
    cutoff = int(time.time()) - DEDUP_WINDOW_SECONDS
    session = get_session()
    try:
        existing = (
            session.query(Alert)
            .filter(
                Alert.symbol == symbol,
                Alert.alert_type == alert_type,
                Alert.sent_at >= cutoff,
            )
            .first()
        )
        return existing is not None
    finally:
        session.close()


def _record_alert(symbol: str, pattern_name: str, timeframe: str, message: str) -> None:
    session = get_session()
    try:
        session.add(Alert(
            symbol=symbol,
            alert_type=f"{pattern_name}|{timeframe}",
            message=message,
            sent_at=int(time.time()),
        ))
        session.commit()
    finally:
        session.close()


def send_alert(symbol: str, pattern_name: str, timeframe: str,
               confidence: int, direction: str, sector: str = "") -> None:
    if confidence < ALERT_MIN_CONFIDENCE:
        return
    if is_duplicate_alert(symbol, pattern_name, timeframe):
        return

    from datetime import datetime
    from zoneinfo import ZoneInfo
    ist_time = datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%d-%b %H:%M IST")
    trend_arrow = "↑" if direction == "bullish" else "↓" if direction == "bearish" else "→"
    sector_line = f"\nSector: {sector} {trend_arrow}" if sector else ""

    message = (
        f"🔔 {symbol} | {pattern_name.replace('_', ' ').title()} | {timeframe}\n"
        f"Confidence: {confidence}% | Trend: {direction.title()}{sector_line}\n"
        f"{ist_time}"
    )

    try:
        bot = telegram.Bot(token=TELEGRAM_BOT_TOKEN)
        asyncio.run(bot.send_message(chat_id=TELEGRAM_CHAT_ID, text=message))
        _record_alert(symbol, pattern_name, timeframe, message)
        logger.info(f"Alert sent: {symbol} {pattern_name} {timeframe}")
    except Exception as e:
        logger.error(f"Telegram alert failed: {e}")

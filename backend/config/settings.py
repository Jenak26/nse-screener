from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./nse_screener.db"
    stock_universe_path: str = "data/nifty500.csv"
    pipeline_run_hour: int = 6
    pipeline_run_minute: int = 30
    cors_origins: str = "http://localhost:5173"
    seed_path: str = "data/seed_stocks.csv"
    # Hosts with an ephemeral disk refresh via the committed snapshot (GitHub Action)
    # instead, so they turn both of these off.
    refresh_on_startup: bool = True
    scheduler_enabled: bool = True
    admin_token: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

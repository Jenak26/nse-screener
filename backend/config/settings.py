from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./nse_screener.db"
    stock_universe_path: str = "data/nifty500.csv"
    pipeline_run_hour: int = 6
    pipeline_run_minute: int = 30
    cors_origins: str = "http://localhost:5173"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

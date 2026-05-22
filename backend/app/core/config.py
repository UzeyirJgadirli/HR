from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "HR Resume Ranking API"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    upload_dir: str = "./uploads"
    max_upload_files: int = 100
    database_url: str = "sqlite:///./hr_ranker.db"
    anthropic_api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()

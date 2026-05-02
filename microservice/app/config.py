"""Configuration for Blueprint Microservice"""

from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings from environment variables"""

    # Service
    service_name: str = "eximia-blueprint-microservice"
    service_version: str = "0.1.0"
    environment: str = Field(default="development")
    debug: bool = Field(default=False)
    log_level: str = Field(default="INFO")

    # API
    api_port: int = Field(default=8000)
    api_host: str = Field(default="0.0.0.0")

    # Supabase
    supabase_url: str = Field(default="")
    supabase_key: str = Field(default="")
    supabase_service_key: str = Field(default="")

    # Microservice Communication
    next_app_url: str = Field(default="http://localhost:3000")
    internal_auth_token: str = Field(default="dev-token-change-in-prod")

    # DIALECTICA
    dialectica_path: str = Field(default="../dialectica")
    max_concurrent_jobs: int = Field(default=3)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


settings = Settings()

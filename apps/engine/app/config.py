from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Configuración del engine cargada desde variables de entorno."""

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/revenue_copilot"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # LLM
    llm_provider: str = "openai"
    llm_api_key: str = ""
    llm_model: str = "gpt-4o-mini"

    # Auth
    jwt_secret: str = "change-me-in-production"

    # App
    environment: str = "development"
    debug: bool = True

    class Config:
        env_file = ".env"
        env_prefix = "ENGINE_"


settings = Settings()

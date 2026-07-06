import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "CaterSync AI Inference Service"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"
    
    # Database connection URL
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/catersync")
    
    # Path where ML models are stored
    MODELS_DIR: str = os.getenv("MODELS_DIR", os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models"
    ))
    
    class Config:
        case_sensitive = True

settings = Settings()

# Ensure models directory exists
os.makedirs(settings.MODELS_DIR, exist_ok=True)

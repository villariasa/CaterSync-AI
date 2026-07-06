import os
import joblib
import logging
from typing import Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

class ModelRegistry:
    def __init__(self):
        self._models: Dict[str, Any] = {}
        
    def load_model(self, name: str, filename: str) -> Optional[Any]:
        """
        Safely loads a model from disk and stores it in memory.
        If file doesn't exist, logs a warning and returns None (letting the endpoints fallback).
        """
        if name in self._models:
            return self._models[name]
            
        model_path = os.path.join(settings.MODELS_DIR, filename)
        if not os.path.exists(model_path):
            logger.warning(f"⚠️ Model file '{filename}' not found at {model_path}. Fallback models/heuristics will be used.")
            return None
            
        try:
            logger.info(f"🔄 Loading model '{name}' from {model_path}...")
            model = joblib.load(model_path)
            self._models[name] = model
            logger.info(f"✅ Model '{name}' loaded successfully.")
            return model
        except Exception as e:
            logger.error(f"❌ Failed to load model '{name}' from {model_path}: {str(e)}")
            return None

    def get_model(self, name: str) -> Optional[Any]:
        return self._models.get(name)

# Global singleton registry
model_registry = ModelRegistry()

import os
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = BASE_DIR / ".env"

# Automatically load environment variables from .env file
if ENV_PATH.exists():
    load_dotenv(ENV_PATH, override=True)
else:
    load_dotenv(override=True)

from typing import List

CSV_PATH = BASE_DIR / "binary_bug_detection_dataset.csv"

def load_gemini_keys() -> List[str]:
    keys: List[str] = []
    # Primary key
    main_key = os.getenv("GEMINI_API_KEY", "").strip()
    if main_key:
        keys.append(main_key)
    # Numbered fallback keys (GEMINI_API_KEY1 .. GEMINI_API_KEY10)
    for i in range(1, 11):
        k = os.getenv(f"GEMINI_API_KEY{i}", "").strip()
        if k and k not in keys:
            keys.append(k)
    # Google API Key alternative
    google_key = os.getenv("GOOGLE_API_KEY", "").strip()
    if google_key and google_key not in keys:
        keys.append(google_key)
    return keys

_loaded_gemini_keys = load_gemini_keys()

class Settings(BaseModel):
    app_name: str = "BugIdentifier: Code-RAG Bug Tracker & Repair"
    csv_path: str = str(CSV_PATH)
    similarity_threshold: float = float(os.getenv("SIMILARITY_THRESHOLD", 0.80))
    mongodb_uri: str = os.getenv("MONGODB_URI", "")
    mongodb_db_name: str = os.getenv("MONGODB_DB_NAME", "bugidentifier_db")
    qdrant_url: str = os.getenv("QDRANT_URL", "")
    qdrant_api_key: str = os.getenv("QDRANT_API_KEY", "")
    qdrant_collection_name: str = os.getenv("QDRANT_COLLECTION_NAME", "delta_rag_vectors")
    gemini_api_keys: List[str] = _loaded_gemini_keys
    gemini_api_key: str = _loaded_gemini_keys[0] if _loaded_gemini_keys else ""
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    temp_dir: str = str(BASE_DIR / "temp_scans")

    def reload_keys(self) -> List[str]:
        if ENV_PATH.exists():
            load_dotenv(ENV_PATH, override=True)
        keys = load_gemini_keys()
        self.gemini_api_keys = keys
        self.gemini_api_key = keys[0] if keys else ""
        return keys

settings = Settings()
os.makedirs(settings.temp_dir, exist_ok=True)

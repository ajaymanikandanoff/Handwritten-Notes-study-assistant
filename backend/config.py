import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file (check root and backend)
ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT_DIR / ".env"
if not ENV_PATH.exists():
    ENV_PATH = Path(__file__).resolve().parent / ".env"

load_dotenv(dotenv_path=ENV_PATH)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY") or ""
VISION_PROVIDER = os.getenv("VISION_PROVIDER", "gemini").lower()

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
DISABLE_EASYOCR = os.getenv("DISABLE_EASYOCR", "false").lower() in ("true", "1", "yes")

CORS_ORIGINS_RAW = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
CORS_ORIGINS = [origin.strip() for origin in CORS_ORIGINS_RAW.split(",") if origin.strip()]

UPLOADS_DIR = ROOT_DIR / os.getenv("UPLOADS_DIR", "backend/uploads")
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

"""Local demo vs production configuration.

Set LOCAL_DEMO=1 (via start-demo.sh) to run without .env, Neon, Redis, Gemini, or Cloudinary.
"""
import os

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
SQLITE_PATH = os.path.join(_BACKEND_DIR, "mock_v4.db")
LOCAL_DATABASE_URL = f"sqlite:///{SQLITE_PATH}"

_local_flag = os.getenv("LOCAL_DEMO", "").lower() in ("1", "true", "yes", "on")

# In local demo mode, ignore .env so company/production credentials are never loaded.
if not _local_flag:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=os.path.join(_BACKEND_DIR, ".env"))

LOCAL_DEMO = _local_flag or not os.getenv("DATABASE_URL")

MATCHMAKE_BATCH_SIZE = 3 if LOCAL_DEMO else 10
WAITING_POOL_TARGET = 15 if LOCAL_DEMO else 30
AUTO_MATCHMAKE_ON_JOIN = not LOCAL_DEMO  # skip slow background task during live demo

# Gemini Layer 3 embeddings — on in production when API key is set; lexical fallback on failure
USE_GEMINI_EMBEDDINGS = not LOCAL_DEMO and bool(os.getenv("GEMINI_API_KEY", "").strip())


def get_database_url() -> str:
    if LOCAL_DEMO:
        return LOCAL_DATABASE_URL
    url = (os.getenv("DATABASE_URL") or LOCAL_DATABASE_URL).strip()
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url

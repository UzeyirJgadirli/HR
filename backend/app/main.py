import logging
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(stream=sys.stdout, level=logging.INFO)
logger = logging.getLogger(__name__)

from app.api.routes import router
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.models import candidate, job, ranking  # noqa: F401

# Use /tmp for uploads — always writable on any platform
upload_dir = Path("/tmp/uploads")
try:
    upload_dir.mkdir(parents=True, exist_ok=True)
    logger.info("Upload dir ready: %s", upload_dir)
except Exception as exc:
    logger.error("Could not create upload dir: %s", exc)

try:
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables ready")
except Exception as exc:
    logger.warning("Database initialization skipped: %s", exc)

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
logger.info("App startup complete")

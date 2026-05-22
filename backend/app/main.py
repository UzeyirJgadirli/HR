from pathlib import Path
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.models import candidate, job, ranking  # noqa: F401


logger = logging.getLogger(__name__)

Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)

try:
    Base.metadata.create_all(bind=engine)
except Exception as exc:  # noqa: BLE001
    logger.warning("Database initialization skipped at startup: %s", exc)

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

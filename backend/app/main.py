import asyncio
import logging
import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.services.scheduler import run_sync, start_scheduler, stop_scheduler

# Configure logging - reduce SQLAlchemy verbosity
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)
# Silence SQLAlchemy engine logs (very verbose)
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)
# Silence httpx/httpcore logs
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: start scheduler + trigger background sync. Shutdown: stop scheduler."""
    if settings.github_oauth_client_id and settings.github_oauth_client_secret:
        logger.info("GitHub OAuth is configured (Connect with GitHub enabled)")
    start_scheduler()
    # Run initial sync in background - don't block app startup
    asyncio.create_task(_run_initial_sync())
    yield
    stop_scheduler()


async def _run_initial_sync():
    """Run initial sync in background with error handling."""
    try:
        logger.info("Starting initial sync in background...")
        await run_sync()
        logger.info("Initial sync completed")
    except Exception as e:
        logger.error(f"Initial sync failed: {e}")


app = FastAPI(
    title=settings.app_name,
    description="Developer analytics platform measuring DORA and development metrics",
    version="0.6.1",
    lifespan=lifespan,
)


@app.exception_handler(Exception)
async def log_unhandled_exception(request, exc: Exception):
    """Log every unhandled exception with full traceback so 500s appear in backend logs."""
    logger.exception(
        "Unhandled exception on %s %s: %s",
        request.method,
        request.url.path,
        exc,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": f"Welcome to {settings.app_name}"}

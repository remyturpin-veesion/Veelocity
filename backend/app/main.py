import asyncio
import logging
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from app.api.v1.router import api_router
from app.core.config import settings
from app.services.scheduler import run_sync, start_scheduler, stop_scheduler

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.sentry_environment,
        integrations=[
            StarletteIntegration(
                transaction_style="endpoint",
                failed_request_status_codes=range(500, 600),
            ),
            FastApiIntegration(
                transaction_style="endpoint",
            ),
        ],
        traces_sample_rate=0.1,
        send_default_pii=False,
    )

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
_origins = (
    [o.strip() for o in settings.cors_allowed_origins.split(",") if o.strip()]
    if settings.cors_allowed_origins
    else ["*"]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": f"Welcome to {settings.app_name}"}

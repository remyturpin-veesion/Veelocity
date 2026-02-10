from fastapi import APIRouter

from app.api.v1.endpoints import (
    actions,
    auth,
    connectors,
    cursor,
    developers,
    export,
    greptile,
    github,
    linear,
    metrics,
    repositories,
    sentry,
    settings,
    sync,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(connectors.router)
api_router.include_router(github.router)
api_router.include_router(actions.router)
api_router.include_router(linear.router)
api_router.include_router(metrics.router)
api_router.include_router(repositories.router)
api_router.include_router(developers.router)
api_router.include_router(settings.router)
api_router.include_router(sentry.router)
api_router.include_router(cursor.router)
api_router.include_router(greptile.router)
api_router.include_router(sync.router)
api_router.include_router(export.router)


@api_router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}

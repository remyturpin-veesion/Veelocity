from fastapi import APIRouter, Depends

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
    users,
)
from app.core.deps import get_current_user

api_router = APIRouter()

# Auth routes are public (register, login, me, GitHub OAuth)
api_router.include_router(auth.router)

# All other API routes require a valid JWT
api_router.include_router(connectors.router, dependencies=[Depends(get_current_user)])
api_router.include_router(github.router, dependencies=[Depends(get_current_user)])
api_router.include_router(actions.router, dependencies=[Depends(get_current_user)])
api_router.include_router(linear.router, dependencies=[Depends(get_current_user)])
api_router.include_router(metrics.router, dependencies=[Depends(get_current_user)])
api_router.include_router(repositories.router, dependencies=[Depends(get_current_user)])
api_router.include_router(developers.router, dependencies=[Depends(get_current_user)])
api_router.include_router(settings.router, dependencies=[Depends(get_current_user)])
api_router.include_router(sentry.router, dependencies=[Depends(get_current_user)])
api_router.include_router(cursor.router, dependencies=[Depends(get_current_user)])
api_router.include_router(greptile.router, dependencies=[Depends(get_current_user)])
api_router.include_router(sync.router, dependencies=[Depends(get_current_user)])
api_router.include_router(export.router, dependencies=[Depends(get_current_user)])
api_router.include_router(users.router, dependencies=[Depends(get_current_user)])


@api_router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}

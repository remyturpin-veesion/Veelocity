from fastapi import APIRouter

from app.api.v1.endpoints import actions, connectors, github, metrics

api_router = APIRouter()

api_router.include_router(connectors.router)
api_router.include_router(github.router)
api_router.include_router(actions.router)
api_router.include_router(metrics.router)


@api_router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}

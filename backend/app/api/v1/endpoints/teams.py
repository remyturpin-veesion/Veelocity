"""Developer teams API: persistent teams (named groups of GitHub logins) for all users."""

from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.developer_team import DeveloperTeam
from app.schemas.developer_team import (
    DeveloperTeamCreate,
    DeveloperTeamResponse,
    DeveloperTeamUpdate,
    DeveloperTeamsListResponse,
)

router = APIRouter(prefix="/teams", tags=["teams"])


def _to_response(team: DeveloperTeam) -> DeveloperTeamResponse:
    return DeveloperTeamResponse(id=str(team.id), name=team.name, members=team.members or [])


@router.get("", response_model=DeveloperTeamsListResponse)
async def list_teams(db: AsyncSession = Depends(get_db)):
    """List all developer teams. Shared across all users."""
    result = await db.execute(select(DeveloperTeam).order_by(DeveloperTeam.name))
    teams = result.scalars().all()
    return DeveloperTeamsListResponse(teams=[_to_response(t) for t in teams])


@router.post("", response_model=DeveloperTeamResponse, status_code=201)
async def create_team(body: DeveloperTeamCreate, db: AsyncSession = Depends(get_db)):
    """Create a new developer team."""
    team = DeveloperTeam(name=body.name, members=body.members)
    db.add(team)
    await db.commit()
    await db.refresh(team)
    return _to_response(team)


@router.get("/{team_id}", response_model=DeveloperTeamResponse)
async def get_team(team_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single team by id."""
    try:
        tid = int(team_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Team not found")
    result = await db.execute(select(DeveloperTeam).where(DeveloperTeam.id == tid))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return _to_response(team)


@router.put("/{team_id}", response_model=DeveloperTeamResponse)
async def update_team(
    team_id: str, body: DeveloperTeamUpdate, db: AsyncSession = Depends(get_db)
):
    """Update a developer team."""
    try:
        tid = int(team_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Team not found")
    result = await db.execute(select(DeveloperTeam).where(DeveloperTeam.id == tid))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    team.name = body.name
    team.members = body.members
    await db.commit()
    await db.refresh(team)
    return _to_response(team)


@router.delete("/{team_id}", status_code=204)
async def delete_team(team_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a developer team."""
    try:
        tid = int(team_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Team not found")
    result = await db.execute(select(DeveloperTeam).where(DeveloperTeam.id == tid))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    await db.delete(team)
    await db.commit()

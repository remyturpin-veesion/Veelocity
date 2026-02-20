"""Pydantic schemas for developer teams (CRUD)."""

from pydantic import BaseModel, Field


class DeveloperTeamBase(BaseModel):
    """Shared fields for create/update."""

    name: str = Field(..., min_length=1, max_length=255)
    members: list[str] = Field(..., description="GitHub logins")


class DeveloperTeamCreate(DeveloperTeamBase):
    """Payload for creating a team."""

    pass


class DeveloperTeamUpdate(DeveloperTeamBase):
    """Payload for updating a team."""

    pass


class DeveloperTeamResponse(DeveloperTeamBase):
    """Team as returned by the API. id is string for frontend compatibility."""

    id: str

    class Config:
        from_attributes = True


class DeveloperTeamsListResponse(BaseModel):
    """List of all developer teams."""

    teams: list[DeveloperTeamResponse]

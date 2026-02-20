"""User management: list users, create user, set active status."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.auth import UserCreateAdmin, UserOut
from app.services.auth_service import create_user, delete_user, list_users, set_user_active

router = APIRouter(prefix="/users", tags=["users"])


class UserActiveUpdate(BaseModel):
    is_active: bool


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def users_create(
    body: UserCreateAdmin,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new user (email, password, is_active). Only active users can call this."""
    try:
        user = await create_user(db, body.email, body.password, body.is_active)
        return UserOut.model_validate(user)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e


@router.get("", response_model=list[UserOut])
@router.get("/", response_model=list[UserOut])
async def users_list(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all users (email, id, is_active). Only active users can call this."""
    users = await list_users(db)
    return [UserOut.model_validate(u) for u in users]


@router.patch("/{user_id}", response_model=UserOut)
async def user_set_active(
    user_id: int,
    body: UserActiveUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set is_active for a user. Only active users can call this."""
    user = await set_user_active(db, user_id, body.is_active)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return UserOut.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def user_delete(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Hard-delete a user. Cannot delete yourself."""
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account",
        )
    deleted = await delete_user(db, user_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

"""Pydantic schemas for user registration, login, and token responses."""

from pydantic import BaseModel, EmailStr, Field, model_validator


class UserCreate(BaseModel):
    """Payload for creating a new user."""

    email: EmailStr
    password: str = Field(..., min_length=8, max_length=2048)


class UserLogin(BaseModel):
    """Payload for login (email + password)."""

    email: EmailStr
    password: str = Field(..., max_length=2048)


class UserOut(BaseModel):
    """Public user info (no password)."""

    id: int
    email: str
    is_active: bool = True

    model_config = {"from_attributes": True}


class Token(BaseModel):
    """JWT access token response."""

    access_token: str
    token_type: str = "bearer"
    user: UserOut


class RegisterResponse(BaseModel):
    """Response when registration succeeds but user is not yet active (no token)."""

    user: UserOut
    message: str


class PasswordChange(BaseModel):
    """Payload for changing password (current + new with confirmation)."""

    current_password: str = Field(..., max_length=2048)
    new_password: str = Field(..., min_length=8, max_length=2048)
    new_password_confirm: str = Field(..., min_length=8, max_length=2048)

    @model_validator(mode="after")
    def passwords_match(self):
        """Ensure new password and confirmation are identical."""
        if self.new_password != self.new_password_confirm:
            raise ValueError("New password and confirmation do not match")
        return self

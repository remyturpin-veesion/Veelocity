#!/usr/bin/env python3
"""
One-off script: delete all Linear data from the database (tables unchanged).

Order: LinearIssue -> LinearWorkflowState -> LinearTeam, then SyncState for linear.
Run from backend dir: uv run python scripts/clear_linear_data.py
"""

import asyncio

from sqlalchemy import delete

from app.core.database import async_session_maker
from app.models.linear import LinearIssue, LinearTeam, LinearWorkflowState
from app.models.sync import SyncState


async def main() -> None:
    async with async_session_maker() as session:
        await session.execute(delete(LinearIssue))
        await session.execute(delete(LinearWorkflowState))
        await session.execute(delete(LinearTeam))
        await session.execute(delete(SyncState).where(SyncState.connector_name == "linear"))
        await session.commit()
    print("Linear data cleared (issues, workflow_states, teams, linear sync state).")


if __name__ == "__main__":
    asyncio.run(main())

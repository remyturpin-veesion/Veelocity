"""PR to Issue linking service."""

import re
from typing import Pattern

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.github import PullRequest
from app.models.linear import LinearIssue

# Patterns for extracting issue identifiers
# Matches: ENG-123, [ENG-123], (ENG-123), feature/ENG-123-description
ISSUE_PATTERN: Pattern = re.compile(
    r"(?:^|[\[\(\s/])([A-Z]{2,10}-\d+)(?:[\]\)\s\-]|$)",
    re.IGNORECASE,
)


def extract_issue_identifiers(text: str) -> list[str]:
    """
    Extract issue identifiers from text.
    
    Supports formats:
    - ENG-123
    - [ENG-123]
    - feature/ENG-123-description
    - Fix ENG-123: description
    """
    if not text:
        return []
    
    matches = ISSUE_PATTERN.findall(text)
    # Normalize to uppercase
    return list(set(m.upper() for m in matches))


class LinkingService:
    """Links PRs to Linear issues."""

    def __init__(self, db: AsyncSession):
        self._db = db

    async def link_all_prs(self) -> int:
        """
        Find and link all PRs to their corresponding Linear issues.
        
        Returns count of links created.
        """
        count = 0

        # Get all PRs
        result = await self._db.execute(select(PullRequest))
        prs = result.scalars().all()

        # Get all issue identifiers for quick lookup
        issue_result = await self._db.execute(
            select(LinearIssue.id, LinearIssue.identifier)
        )
        issue_map = {row.identifier.upper(): row.id for row in issue_result}

        for pr in prs:
            # Extract identifiers from branch name, title, and body
            identifiers = set()
            if getattr(pr, "head_branch", None):
                identifiers.update(extract_issue_identifiers(pr.head_branch))
            identifiers.update(extract_issue_identifiers(pr.title))
            if pr.body:
                identifiers.update(extract_issue_identifiers(pr.body))

            # Find matching issues and link
            for identifier in identifiers:
                issue_id = issue_map.get(identifier)
                if issue_id:
                    await self._db.execute(
                        update(LinearIssue)
                        .where(LinearIssue.id == issue_id)
                        .where(LinearIssue.linked_pr_id.is_(None))  # Don't overwrite existing
                        .values(linked_pr_id=pr.id)
                    )
                    count += 1

        await self._db.commit()
        return count

    async def link_pr(self, pr: PullRequest) -> LinearIssue | None:
        """
        Link a single PR to its Linear issue.
        
        Returns the linked issue, or None if no match found.
        """
        identifiers = set()
        if getattr(pr, "head_branch", None):
            identifiers.update(extract_issue_identifiers(pr.head_branch))
        identifiers.update(extract_issue_identifiers(pr.title))
        if pr.body:
            identifiers.update(extract_issue_identifiers(pr.body))

        for identifier in identifiers:
            result = await self._db.execute(
                select(LinearIssue).where(
                    LinearIssue.identifier == identifier.upper()
                )
            )
            issue = result.scalar_one_or_none()
            if issue and not issue.linked_pr_id:
                issue.linked_pr_id = pr.id
                await self._db.flush()
                return issue

        return None

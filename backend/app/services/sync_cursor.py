"""Sync Cursor API data into PostgreSQL (team, spend, daily usage, DAU)."""

import logging
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cursor import (
    CursorDau,
    CursorDailyUsage,
    CursorSpendSnapshot,
    CursorTeamMember,
)
from app.services.cursor_client import (
    get_analytics_dau,
    get_daily_usage,
    get_spend,
    get_team_members,
)
from app.services.sync_state import SyncStateService

logger = logging.getLogger(__name__)


def _get_num(record: dict, *keys: str) -> int:
    """Get first present numeric value from record."""
    for k in keys:
        v = record.get(k)
        if v is not None and isinstance(v, (int, float)):
            return int(v)
    return 0


def _get_date(record: dict) -> str | None:
    """Extract date string from record."""
    date_val = record.get("date") or record.get("day")
    if isinstance(date_val, str) and len(date_val) >= 10:
        return date_val[:10]
    if isinstance(date_val, (int, float)):
        try:
            dt = datetime.fromtimestamp(
                date_val / 1000 if date_val > 1e12 else date_val, tz=timezone.utc
            )
            return dt.date().isoformat()
        except (OSError, ValueError):
            pass
    return None


def _extract_usage_list(payload: dict | list | None) -> list[dict]:
    """Extract list of daily usage records from API response."""
    if payload is None:
        return []
    if isinstance(payload, list):
        return [r for r in payload if isinstance(r, dict)]
    if not isinstance(payload, dict):
        return []
    for key in ("data", "dailyUsage", "usage", "dailyUsageData", "records", "items"):
        val = payload.get(key)
        if isinstance(val, list):
            return [r for r in val if isinstance(r, dict)]
    data = payload.get("data")
    if isinstance(data, dict):
        for key in ("dailyUsage", "usage", "records", "items", "data"):
            val = data.get(key) if isinstance(data, dict) else None
            if isinstance(val, list):
                return [r for r in val if isinstance(r, dict)]
    return []


def _aggregate_usage_by_date(raw_data: list[dict]) -> dict[str, dict]:
    """Aggregate raw daily-usage records by date. Returns dict date_str -> row."""
    by_date: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for record in raw_data:
        if not isinstance(record, dict):
            continue
        date_str = _get_date(record)
        if not date_str:
            continue
        row = by_date[date_str]
        row["lines_added"] += _get_num(record, "totalLinesAdded", "total_lines_added")
        row["lines_deleted"] += _get_num(
            record, "totalLinesDeleted", "totalLinesRemoved", "total_lines_deleted"
        )
        row["accepted_lines_added"] += _get_num(
            record, "acceptedLinesAdded", "accepted_lines_added"
        )
        row["accepted_lines_deleted"] += _get_num(
            record, "acceptedLinesDeleted", "accepted_lines_deleted"
        )
        row["composer_requests"] += _get_num(
            record, "composerRequests", "composer_requests"
        )
        row["chat_requests"] += _get_num(record, "chatRequests", "chat_requests")
        row["agent_requests"] += _get_num(record, "agentRequests", "agent_requests")
        row["tabs_shown"] += _get_num(record, "totalTabsShown", "total_tabs_shown")
        row["tabs_accepted"] += _get_num(
            record, "totalTabsAccepted", "total_tabs_accepted"
        )
        row["applies"] += _get_num(record, "totalApplies", "total_applies")
        row["accepts"] += _get_num(record, "totalAccepts", "total_accepts")
        row["rejects"] += _get_num(record, "totalRejects", "total_rejects")
        row["cmdk_usages"] += _get_num(record, "cmdkUsages", "cmdk_usages")
        row["bugbot_usages"] += _get_num(record, "bugbotUsages", "bugbot_usages")
    return dict(by_date)


async def sync_cursor(db: AsyncSession, api_key: str) -> int:
    """
    Fetch Cursor API data and upsert into DB. Updates SyncState for "cursor".
    Returns number of items written (team count + 1 spend + daily usage rows + dau rows).
    """
    now = datetime.utcnow()
    end_dt = datetime.now(timezone.utc).date()
    start_dt = end_dt - timedelta(days=29)
    start_str = start_dt.isoformat()
    end_str = end_dt.isoformat()
    items = 0

    # Team members: replace all
    members_data = await get_team_members(api_key)
    if members_data is not None:
        team = members_data.get("teamMembers") or []
        await db.execute(delete(CursorTeamMember))
        for i, m in enumerate(team):
            if not isinstance(m, dict):
                continue
            email = m.get("email") or m.get("userEmail")
            name = m.get("name") or m.get("displayName") or m.get("display_name")
            db.add(
                CursorTeamMember(
                    email=str(email) if email else None,
                    display_name=str(name)[:255] if name else None,
                    synced_at=now,
                )
            )
            items += 1
        await db.flush()

    # Spend: insert snapshot
    spend_data = await get_spend(api_key)
    if spend_data is not None:
        total_cents = sum(
            m.get("spendCents") or 0 for m in (spend_data.get("teamMemberSpend") or [])
        )
        total_members = spend_data.get("totalMembers")
        db.add(
            CursorSpendSnapshot(
                total_cents=total_cents,
                total_members=total_members,
                synced_at=now,
            )
        )
        items += 1
        await db.flush()

    # Daily usage: fetch in 7-day chunks, aggregate, upsert
    raw_usage: list[dict] = []
    use_seconds = False
    chunk_start = start_dt
    CHUNK_DAYS = 7
    while chunk_start <= end_dt:
        chunk_end = min(
            chunk_start + timedelta(days=CHUNK_DAYS - 1),
            end_dt,
        )
        start_ts = int(
            datetime(
                chunk_start.year,
                chunk_start.month,
                chunk_start.day,
                0,
                0,
                0,
                tzinfo=timezone.utc,
            ).timestamp()
            * 1000
        )
        end_ts = int(
            datetime(
                chunk_end.year,
                chunk_end.month,
                chunk_end.day,
                23,
                59,
                59,
                tzinfo=timezone.utc,
            ).timestamp()
            * 1000
        )
        usage_data = await get_daily_usage(
            api_key, start_ts, end_ts, use_seconds=use_seconds
        )
        chunk_list = _extract_usage_list(usage_data)
        if not chunk_list and not use_seconds and usage_data is not None:
            usage_data = await get_daily_usage(
                api_key, start_ts, end_ts, use_seconds=True
            )
            chunk_list = _extract_usage_list(usage_data)
            if chunk_list:
                use_seconds = True
        raw_usage.extend(chunk_list)
        chunk_start = chunk_end + timedelta(days=1)

    if raw_usage:
        by_date = _aggregate_usage_by_date(raw_usage)
        for date_str, row in by_date.items():
            try:
                d = date.fromisoformat(date_str)
            except ValueError:
                continue
            stmt = pg_insert(CursorDailyUsage).values(
                date=d,
                lines_added=row.get("lines_added", 0),
                lines_deleted=row.get("lines_deleted", 0),
                accepted_lines_added=row.get("accepted_lines_added", 0),
                accepted_lines_deleted=row.get("accepted_lines_deleted", 0),
                composer_requests=row.get("composer_requests", 0),
                chat_requests=row.get("chat_requests", 0),
                agent_requests=row.get("agent_requests", 0),
                tabs_shown=row.get("tabs_shown", 0),
                tabs_accepted=row.get("tabs_accepted", 0),
                applies=row.get("applies", 0),
                accepts=row.get("accepts", 0),
                rejects=row.get("rejects", 0),
                cmdk_usages=row.get("cmdk_usages", 0),
                bugbot_usages=row.get("bugbot_usages", 0),
                synced_at=now,
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=["date"],
                set_={
                    CursorDailyUsage.lines_added: stmt.excluded.lines_added,
                    CursorDailyUsage.lines_deleted: stmt.excluded.lines_deleted,
                    CursorDailyUsage.accepted_lines_added: stmt.excluded.accepted_lines_added,
                    CursorDailyUsage.accepted_lines_deleted: stmt.excluded.accepted_lines_deleted,
                    CursorDailyUsage.composer_requests: stmt.excluded.composer_requests,
                    CursorDailyUsage.chat_requests: stmt.excluded.chat_requests,
                    CursorDailyUsage.agent_requests: stmt.excluded.agent_requests,
                    CursorDailyUsage.tabs_shown: stmt.excluded.tabs_shown,
                    CursorDailyUsage.tabs_accepted: stmt.excluded.tabs_accepted,
                    CursorDailyUsage.applies: stmt.excluded.applies,
                    CursorDailyUsage.accepts: stmt.excluded.accepts,
                    CursorDailyUsage.rejects: stmt.excluded.rejects,
                    CursorDailyUsage.cmdk_usages: stmt.excluded.cmdk_usages,
                    CursorDailyUsage.bugbot_usages: stmt.excluded.bugbot_usages,
                    CursorDailyUsage.synced_at: stmt.excluded.synced_at,
                },
            )
            await db.execute(stmt)
            items += 1
        await db.flush()

    # DAU (Enterprise): fetch and upsert by date
    dau_data = await get_analytics_dau(api_key, start_str, end_str)
    if dau_data and dau_data.get("data"):
        data = dau_data["data"]
        if isinstance(data, list):
            for record in data:
                if not isinstance(record, dict):
                    continue
                date_str = _get_date(record)
                if not date_str:
                    continue
                try:
                    d = date.fromisoformat(date_str)
                except ValueError:
                    continue
                count = _get_num(record, "dau", "count", "activeUsers", "value")
                stmt = pg_insert(CursorDau).values(
                    date=d, dau_count=count, synced_at=now
                )
                stmt = stmt.on_conflict_do_update(
                    index_elements=["date"],
                    set_={
                        CursorDau.dau_count: stmt.excluded.dau_count,
                        CursorDau.synced_at: stmt.excluded.synced_at,
                    },
                )
                await db.execute(stmt)
                items += 1
        await db.flush()

    sync_state = SyncStateService(db)
    await sync_state.update_last_sync("cursor", sync_at=now)
    await db.flush()
    logger.info("Cursor sync: %s items", items)
    return items

#!/usr/bin/env python3
"""
Run a read-only SQL query against the Veelocity database.
Uses backend .env / DATABASE_URL. Run from backend dir: uv run python scripts/query_db.py "SELECT ..."
"""

import argparse
import asyncio
import sys
from pathlib import Path

# Ensure backend root is on path when running script directly
_backend_root = Path(__file__).resolve().parent.parent
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from sqlalchemy import text

from app.core.database import async_session_maker


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a read-only SQL query")
    parser.add_argument("query", nargs="?", help="SQL query (SELECT only)")
    parser.add_argument("-f", "--file", help="Read query from file")
    args = parser.parse_args()

    if args.file:
        with open(args.file, encoding="utf-8") as f:
            sql = f.read().strip()
    elif args.query:
        sql = args.query.strip()
    else:
        parser.error("Provide a query string or -f path/to/query.sql")

    if not sql.upper().startswith("SELECT"):
        print("Only SELECT queries are allowed.", file=sys.stderr)
        sys.exit(1)

    async def run() -> None:
        async with async_session_maker() as session:
            result = await session.execute(text(sql))
            rows = result.fetchall()
            keys = list(result.keys()) if rows else []

        if not keys:
            print("(no columns)")
            return

        # Column widths
        widths = [max(len(str(k)), 2) for k in keys]
        for row in rows:
            for i, v in enumerate(row):
                if i < len(widths):
                    widths[i] = max(widths[i], len(str(v)) if v is not None else 4)

        # Header
        header = " | ".join(str(k).ljust(widths[i]) for i, k in enumerate(keys))
        print(header)
        print("-+-".join("-" * w for w in widths))
        for row in rows:
            print(" | ".join((str(v) if v is not None else "NULL").ljust(widths[i]) for i, v in enumerate(row)))

        if not rows:
            print("(0 rows)")

    asyncio.run(run())


if __name__ == "__main__":
    main()

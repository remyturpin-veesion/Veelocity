"""Metric correlation analysis service."""

from datetime import datetime
from typing import Literal

import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.metrics.development import DevelopmentMetricsService
from app.services.metrics.dora import DORAMetricsService


def _align_series(
    series_a: list[dict],
    series_b: list[dict],
    key_a: str,
    key_b: str,
    value_a: str,
    value_b: str,
) -> tuple[list[float], list[float]]:
    """Align two period-keyed series by common periods; return (values_a, values_b)."""
    map_a = {d[key_a]: d[value_a] for d in series_a}
    map_b = {d[key_b]: d[value_b] for d in series_b}
    common = sorted(set(map_a) & set(map_b))
    return ([map_a[p] for p in common], [map_b[p] for p in common])


def _pearson(x: list[float], y: list[float]) -> float | None:
    """Pearson correlation; None if insufficient data or zero variance."""
    if len(x) < 3 or len(x) != len(y):
        return None
    xa, ya = np.array(x, dtype=float), np.array(y, dtype=float)
    if np.std(xa) == 0 or np.std(ya) == 0:
        return None
    r = np.corrcoef(xa, ya)[0, 1]
    return round(float(r), 4)


class CorrelationService:
    """Compute pairwise correlations between metrics over time."""

    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_correlations(
        self,
        start_date: datetime,
        end_date: datetime,
        period: Literal["day", "week", "month"] = "week",
        repo_id: int | None = None,
        repo_ids: list[int] | None = None,
    ) -> list[dict]:
        """
        Return pairwise correlations between deployment frequency, throughput,
        and lead time (median per period).

        Each item: {"metric_a": str, "metric_b": str, "correlation": float, "period_count": int}.
        """
        dora = DORAMetricsService(self._db)
        dev = DevelopmentMetricsService(self._db)

        deploy = await dora.get_deployment_frequency(
            start_date, end_date, period, repo_id, repo_ids, None
        )
        throughput = await dev.get_throughput(
            start_date, end_date, period, repo_id, repo_ids, None
        )
        lead_by_period = await dora.get_lead_time_by_period(
            start_date, end_date, period, repo_id, repo_ids, None
        )

        data_deploy = deploy.get("data") or []
        data_throughput = throughput.get("data") or []

        pairs: list[dict] = []

        # deployment_frequency vs throughput (count vs count)
        x_d, x_t = _align_series(
            data_deploy,
            data_throughput,
            "period",
            "period",
            "count",
            "count",
        )
        r = _pearson(x_d, x_t)
        if r is not None:
            pairs.append(
                {
                    "metric_a": "deployment_frequency",
                    "metric_b": "throughput",
                    "correlation": r,
                    "period_count": len(x_d),
                }
            )

        # deployment_frequency vs lead_time (count vs median_hours)
        x_d2, x_lt = _align_series(
            data_deploy,
            lead_by_period,
            "period",
            "period",
            "count",
            "median_hours",
        )
        r = _pearson(x_d2, x_lt)
        if r is not None:
            pairs.append(
                {
                    "metric_a": "deployment_frequency",
                    "metric_b": "lead_time",
                    "correlation": r,
                    "period_count": len(x_d2),
                }
            )

        # throughput vs lead_time (count vs median_hours)
        x_t2, x_lt2 = _align_series(
            data_throughput,
            lead_by_period,
            "period",
            "period",
            "count",
            "median_hours",
        )
        r = _pearson(x_t2, x_lt2)
        if r is not None:
            pairs.append(
                {
                    "metric_a": "throughput",
                    "metric_b": "lead_time",
                    "correlation": r,
                    "period_count": len(x_t2),
                }
            )

        return pairs

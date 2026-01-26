"""Rate limiter for API calls to prevent hitting rate limits."""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class RateLimitExceeded(Exception):
    """Raised when rate limit is exceeded."""
    pass


@dataclass
class RateLimiter:
    """
    Rate limiter with configurable limits and delays.
    
    Attributes:
        max_calls_per_sync: Maximum API calls per sync session
        max_calls_per_hour: Maximum API calls per hour (GitHub limit is 5000)
        delay_between_calls: Delay in seconds between API calls
        warn_threshold: Percentage of max_calls_per_sync to warn at
    """
    max_calls_per_sync: int = 500
    max_calls_per_hour: int = 4000  # Leave buffer below GitHub's 5000
    delay_between_calls: float = 0.1  # 100ms between calls
    warn_threshold: float = 0.8  # Warn at 80%

    _call_count: int = field(default=0, init=False)
    _hour_start: datetime = field(default_factory=datetime.utcnow, init=False)
    _hour_calls: int = field(default=0, init=False)

    def reset(self, full: bool = True) -> None:
        """
        Reset call count for new sync session.
        
        Args:
            full: If True, also reset hourly counter. Default True for batch operations.
        """
        self._call_count = 0
        if full:
            self._hour_calls = 0
            self._hour_start = datetime.utcnow()
            logger.debug("Rate limiter fully reset (sync + hourly counters)")
        else:
            logger.debug("Rate limiter reset for new sync session (sync counter only)")

    def _check_hour_reset(self) -> None:
        """Reset hourly counter if hour has passed."""
        now = datetime.utcnow()
        if now - self._hour_start > timedelta(hours=1):
            self._hour_start = now
            self._hour_calls = 0
            logger.debug("Hourly rate limit counter reset")

    async def acquire(self) -> None:
        """
        Acquire permission for an API call.
        
        Raises:
            RateLimitExceeded: If rate limit is exceeded
        """
        self._check_hour_reset()

        # Check per-sync limit
        if self._call_count >= self.max_calls_per_sync:
            raise RateLimitExceeded(
                f"Sync rate limit exceeded: {self._call_count}/{self.max_calls_per_sync} calls"
            )

        # Check hourly limit
        if self._hour_calls >= self.max_calls_per_hour:
            raise RateLimitExceeded(
                f"Hourly rate limit exceeded: {self._hour_calls}/{self.max_calls_per_hour} calls"
            )

        # Warn if approaching limit
        warn_at = int(self.max_calls_per_sync * self.warn_threshold)
        if self._call_count == warn_at:
            logger.warning(
                f"Approaching sync rate limit: {self._call_count}/{self.max_calls_per_sync} calls"
            )

        # Increment counters
        self._call_count += 1
        self._hour_calls += 1

        # Add delay between calls
        if self.delay_between_calls > 0:
            await asyncio.sleep(self.delay_between_calls)

    @property
    def calls_made(self) -> int:
        """Number of calls made in current sync session."""
        return self._call_count

    @property
    def calls_remaining(self) -> int:
        """Number of calls remaining in current sync session."""
        return max(0, self.max_calls_per_sync - self._call_count)

    def get_stats(self) -> dict:
        """Get rate limiter statistics."""
        return {
            "calls_made": self._call_count,
            "calls_remaining": self.calls_remaining,
            "max_per_sync": self.max_calls_per_sync,
            "hourly_calls": self._hour_calls,
            "max_per_hour": self.max_calls_per_hour,
        }


# Global rate limiter instance (lazy init)
_rate_limiter: RateLimiter | None = None


def get_rate_limiter() -> RateLimiter:
    """Get the global rate limiter instance, configured from settings."""
    global _rate_limiter
    if _rate_limiter is None:
        from app.core.config import settings
        _rate_limiter = RateLimiter(
            max_calls_per_sync=settings.rate_limit_max_per_sync,
            max_calls_per_hour=settings.rate_limit_max_per_hour,
            delay_between_calls=settings.rate_limit_delay_ms / 1000.0,
        )
        logger.info(
            f"Rate limiter initialized: {settings.rate_limit_max_per_sync}/sync, "
            f"{settings.rate_limit_max_per_hour}/hour, {settings.rate_limit_delay_ms}ms delay"
        )
    return _rate_limiter

"""Rate limiter for API calls to prevent hitting rate limits."""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)


class RateLimitExceeded(Exception):
    """Raised when rate limit is exceeded."""

    pass


@dataclass
class RateLimiter:
    """
    Rate limiter with configurable limits and adaptive throttling.

    Uses both local limits (per-sync, per-hour) and adapts to
    GitHub's actual rate limit headers for proper throttling.

    Attributes:
        max_calls_per_sync: Maximum API calls per sync session
        max_calls_per_hour: Maximum API calls per hour (GitHub limit is 5000)
        delay_between_calls: Base delay in seconds between API calls
        warn_threshold: Percentage of max_calls_per_sync to warn at
        github_throttle_threshold: Start throttling when GitHub remaining < this
        github_pause_threshold: Pause completely when GitHub remaining < this
    """

    max_calls_per_sync: int = 500
    max_calls_per_hour: int = 4000  # Leave buffer below GitHub's 5000
    delay_between_calls: float = 0.1  # 100ms between calls
    warn_threshold: float = 0.8  # Warn at 80%
    github_throttle_threshold: int = 500  # Start throttling when < 500 remaining
    github_pause_threshold: int = 50  # Pause when < 50 remaining

    _call_count: int = field(default=0, init=False)
    _hour_start: datetime = field(default_factory=datetime.utcnow, init=False)
    _hour_calls: int = field(default=0, init=False)

    # GitHub API rate limit tracking (from response headers)
    _github_remaining: int | None = field(default=None, init=False)
    _github_reset_at: datetime | None = field(default=None, init=False)
    _github_limit: int | None = field(default=None, init=False)

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

    def update_from_github_headers(
        self,
        remaining: int | None,
        reset_timestamp: int | None,
        limit: int | None = None,
    ) -> None:
        """
        Update rate limit info from GitHub response headers.

        Args:
            remaining: x-ratelimit-remaining header value
            reset_timestamp: x-ratelimit-reset header value (Unix timestamp)
            limit: x-ratelimit-limit header value
        """
        if remaining is not None:
            self._github_remaining = remaining
        if reset_timestamp is not None:
            self._github_reset_at = datetime.fromtimestamp(
                reset_timestamp, tz=timezone.utc
            )
        if limit is not None:
            self._github_limit = limit

    async def _wait_for_github_reset(self) -> None:
        """Wait until GitHub rate limit resets."""
        if self._github_reset_at is None:
            # No reset time known, wait 60 seconds as fallback
            logger.warning(
                "GitHub rate limit exhausted, waiting 60s (no reset time known)"
            )
            await asyncio.sleep(60)
            return

        now = datetime.now(timezone.utc)
        wait_seconds = (self._github_reset_at - now).total_seconds()

        if wait_seconds > 0:
            # Add 1 second buffer
            wait_seconds = min(wait_seconds + 1, 3600)  # Cap at 1 hour
            logger.warning(
                f"GitHub rate limit exhausted ({self._github_remaining} remaining). "
                f"Waiting {wait_seconds:.0f}s until reset at {self._github_reset_at.isoformat()}"
            )
            await asyncio.sleep(wait_seconds)
            # Reset our tracking after waiting
            self._github_remaining = None
        else:
            # Reset time has passed, GitHub should have reset
            self._github_remaining = None

    def _calculate_adaptive_delay(self) -> float:
        """
        Calculate adaptive delay based on GitHub's remaining rate limit.

        Returns slower delays as we approach the limit to spread out requests.
        """
        if self._github_remaining is None:
            return self.delay_between_calls

        remaining = self._github_remaining

        # If we have reset time, calculate optimal pacing
        if self._github_reset_at is not None and remaining > 0:
            now = datetime.now(timezone.utc)
            seconds_until_reset = max(1, (self._github_reset_at - now).total_seconds())

            # Calculate delay to spread remaining calls over time until reset
            # Leave 20% buffer
            safe_remaining = int(remaining * 0.8)
            if safe_remaining > 0:
                paced_delay = seconds_until_reset / safe_remaining
                # Cap between base delay and 5 seconds
                paced_delay = max(self.delay_between_calls, min(paced_delay, 5.0))
            else:
                paced_delay = 5.0
        else:
            paced_delay = self.delay_between_calls

        # Apply throttling based on thresholds
        if remaining < self.github_pause_threshold:
            # Very close to limit, use maximum delay or wait for reset
            return 5.0
        elif remaining < self.github_throttle_threshold:
            # Approaching limit, use paced delay with minimum floor
            # More aggressive throttling as we get closer to 0
            throttle_factor = (
                1
                + (self.github_throttle_threshold - remaining)
                / self.github_throttle_threshold
            )
            return max(paced_delay, self.delay_between_calls * throttle_factor)
        else:
            return self.delay_between_calls

    async def acquire(self) -> None:
        """
        Acquire permission for an API call.

        Implements adaptive throttling based on GitHub's rate limit.

        Raises:
            RateLimitExceeded: If local rate limit is exceeded
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

        # Check GitHub's actual rate limit and wait if necessary
        if (
            self._github_remaining is not None
            and self._github_remaining < self.github_pause_threshold
        ):
            logger.info(
                f"GitHub rate limit low ({self._github_remaining} remaining), "
                f"waiting for reset..."
            )
            await self._wait_for_github_reset()

        # Warn if approaching local limit
        warn_at = int(self.max_calls_per_sync * self.warn_threshold)
        if self._call_count == warn_at:
            logger.warning(
                f"Approaching sync rate limit: {self._call_count}/{self.max_calls_per_sync} calls"
            )

        # Increment counters
        self._call_count += 1
        self._hour_calls += 1

        # Add adaptive delay between calls
        delay = self._calculate_adaptive_delay()
        if delay > 0:
            if delay > self.delay_between_calls * 2:
                # Log when we're significantly throttling
                logger.debug(
                    f"Throttling: {delay:.2f}s delay (remaining: {self._github_remaining})"
                )
            await asyncio.sleep(delay)

    @property
    def calls_made(self) -> int:
        """Number of calls made in current sync session."""
        return self._call_count

    @property
    def calls_remaining(self) -> int:
        """Number of calls remaining in current sync session."""
        return max(0, self.max_calls_per_sync - self._call_count)

    @property
    def github_remaining(self) -> int | None:
        """GitHub API rate limit remaining (from headers)."""
        return self._github_remaining

    def get_stats(self) -> dict:
        """Get rate limiter statistics."""
        return {
            "calls_made": self._call_count,
            "calls_remaining": self.calls_remaining,
            "max_per_sync": self.max_calls_per_sync,
            "hourly_calls": self._hour_calls,
            "max_per_hour": self.max_calls_per_hour,
            "github_remaining": self._github_remaining,
            "github_reset_at": (
                self._github_reset_at.isoformat() if self._github_reset_at else None
            ),
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

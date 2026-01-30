"""Tests for alert notifications (webhooks and email)."""

import pytest
from unittest.mock import patch

import httpx
import respx

from app.services.insights.notifications import (
    send_alert_notifications,
    _build_payload,
    _email_body,
)


class TestBuildPayload:
    """Test _build_payload."""

    def test_build_payload(self):
        """Payload has start_date, end_date, alerts, alert_count."""
        payload = _build_payload(
            "2026-01-01T00:00:00",
            "2026-01-31T23:59:59",
            [{"rule_id": "r1", "title": "T1", "severity": "high"}],
        )
        assert payload["start_date"] == "2026-01-01T00:00:00"
        assert payload["end_date"] == "2026-01-31T23:59:59"
        assert payload["alert_count"] == 1
        assert len(payload["alerts"]) == 1
        assert payload["alerts"][0]["rule_id"] == "r1"


class TestEmailBody:
    """Test _email_body."""

    def test_email_body_format(self):
        """Email body contains period, count, and alert lines."""
        payload = {
            "start_date": "2026-01-01",
            "end_date": "2026-01-31",
            "alert_count": 1,
            "alerts": [
                {
                    "rule_id": "r1",
                    "title": "Low deployment frequency",
                    "message": "Deploy more often.",
                    "severity": "high",
                    "metric": "deployment_frequency",
                    "current_value": 0.5,
                    "threshold": "≥1/week",
                }
            ],
        }
        body = _email_body(payload)
        assert "2026-01-01" in body
        assert "2026-01-31" in body
        assert "Active alerts: 1" in body
        assert "Low deployment frequency" in body
        assert "Deploy more often" in body
        assert "deployment_frequency" in body
        assert "0.5" in body
        assert "≥1/week" in body


class TestSendAlertNotifications:
    """Test send_alert_notifications."""

    @pytest.mark.asyncio
    async def test_empty_alerts_does_nothing(self):
        """No webhook or email when alerts list is empty."""
        with respx.mock:
            route = respx.post("https://example.com/webhook").mock(
                return_value=httpx.Response(200)
            )
            with patch(
                "app.services.insights.notifications.settings"
            ) as mock_settings:
                mock_settings.alert_webhook_urls = "https://example.com/webhook"
                mock_settings.alert_email_to = "user@example.com"
                mock_settings.smtp_host = "smtp.example.com"
                mock_settings.smtp_port = 587
                mock_settings.smtp_user = ""
                mock_settings.smtp_password = ""
                mock_settings.smtp_from = ""
                await send_alert_notifications(
                    "2026-01-01",
                    "2026-01-31",
                    [],
                )
            assert route.calls == []

    @pytest.mark.asyncio
    async def test_posts_to_webhook_when_alerts_and_url_configured(self):
        """POST to each webhook URL when alerts exist and URLs are set."""
        alerts = [
            {
                "rule_id": "deployment_frequency_low",
                "title": "Deployment frequency below 1/week",
                "message": "Consider automating releases.",
                "severity": "high",
                "metric": "deployment_frequency",
                "current_value": 0.5,
                "threshold": "≥1/week",
            }
        ]
        with respx.mock:
            r1 = respx.post("https://hook1.example.com/alerts").mock(
                return_value=httpx.Response(200)
            )
            r2 = respx.post("https://hook2.example.com/notify").mock(
                return_value=httpx.Response(201)
            )
            with patch(
                "app.services.insights.notifications.settings"
            ) as mock_settings:
                mock_settings.alert_webhook_urls = (
                    "https://hook1.example.com/alerts,"
                    "https://hook2.example.com/notify"
                )
                mock_settings.alert_email_to = ""
                mock_settings.smtp_host = ""
                mock_settings.smtp_from = ""
                mock_settings.smtp_user = ""
                mock_settings.smtp_password = ""
                await send_alert_notifications(
                    "2026-01-01T00:00:00",
                    "2026-01-31T23:59:59",
                    alerts,
                )
            assert len(r1.calls) == 1
            assert len(r2.calls) == 1
            req1 = r1.calls[0].request
            assert req1.headers.get("content-type") == "application/json"
            body = req1.read()
            assert b"deployment_frequency_low" in body
            assert b"alert_count" in body

    @pytest.mark.asyncio
    async def test_no_webhook_when_urls_empty(self):
        """No POST when alert_webhook_urls is empty."""
        alerts = [{"rule_id": "r1", "title": "T1", "severity": "high"}]
        with respx.mock:
            route = respx.post("https://any.example.com/hook").mock(
                return_value=httpx.Response(200)
            )
            with patch(
                "app.services.insights.notifications.settings"
            ) as mock_settings:
                mock_settings.alert_webhook_urls = ""
                mock_settings.alert_email_to = ""
                mock_settings.smtp_host = ""
                await send_alert_notifications(
                    "2026-01-01",
                    "2026-01-31",
                    alerts,
                )
            assert route.calls == []

    @pytest.mark.asyncio
    async def test_email_sent_when_configured(self):
        """Email send is invoked when ALERT_EMAIL_TO and SMTP_HOST set."""
        alerts = [{"rule_id": "r1", "title": "Test", "message": "Msg", "severity": "high", "metric": "m", "current_value": 1, "threshold": "t"}]
        with patch(
            "app.services.insights.notifications.settings"
        ) as mock_settings:
            mock_settings.alert_webhook_urls = ""
            mock_settings.alert_email_to = "alerts@example.com"
            mock_settings.smtp_host = "smtp.example.com"
            mock_settings.smtp_port = 587
            mock_settings.smtp_user = "user"
            mock_settings.smtp_password = "pass"
            mock_settings.smtp_from = "veelocity@example.com"
            with patch(
                "app.services.insights.notifications._send_email_sync",
            ) as mock_send:
                await send_alert_notifications(
                    "2026-01-01",
                    "2026-01-31",
                    alerts,
                )
            assert mock_send.call_count == 1
            call = mock_send.call_args
            assert call.args[0] == "alerts@example.com"
            assert "1 active alert" in call.args[1]  # subject
            assert "Test" in call.args[2]  # body
            assert "Msg" in call.args[2]

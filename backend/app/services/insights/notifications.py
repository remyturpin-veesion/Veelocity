"""Alert notifications: webhooks and optional email.

When alerts are active, this module can POST to configured webhook URLs
and/or send a summary email. Single-user; configuration via environment.
"""

import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Timeout for webhook POSTs
WEBHOOK_TIMEOUT_S = 10.0


def _build_payload(
    start_date: str,
    end_date: str,
    alerts: list[dict[str, Any]],
) -> dict[str, Any]:
    """Build the JSON payload sent to webhooks and used for email body."""
    return {
        "start_date": start_date,
        "end_date": end_date,
        "alerts": alerts,
        "alert_count": len(alerts),
    }


async def _send_webhook(url: str, payload: dict[str, Any]) -> None:
    """POST payload to a single webhook URL. Logs errors, does not raise."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                url,
                json=payload,
                timeout=WEBHOOK_TIMEOUT_S,
                headers={"Content-Type": "application/json"},
            )
            if resp.status_code >= 400:
                logger.warning(
                    "Webhook %s returned %s: %s",
                    url,
                    resp.status_code,
                    resp.text[:200] if resp.text else "",
                )
            else:
                logger.info("Webhook %s delivered successfully", url)
    except Exception as e:
        logger.warning("Webhook %s failed: %s", url, e)


def _send_email_sync(
    to_address: str,
    subject: str,
    body_plain: str,
) -> None:
    """Send email via SMTP (sync). Used from asyncio.to_thread."""
    host = (settings.smtp_host or "").strip()
    if not host or not (to_address or "").strip():
        return
    port = settings.smtp_port or 587
    user = (settings.smtp_user or "").strip()
    password = (settings.smtp_password or "").strip()
    from_addr = (settings.smtp_from or user or "veelocity@localhost").strip()

    try:
        with smtplib.SMTP(host, port) as smtp:
            if user and password:
                smtp.starttls()
                smtp.login(user, password)
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = from_addr
            msg["To"] = to_address
            msg.attach(MIMEText(body_plain, "plain"))
            smtp.sendmail(from_addr, [to_address], msg.as_string())
        logger.info("Alert email sent to %s", to_address)
    except Exception as e:
        logger.warning("Alert email failed: %s", e)


def _email_body(payload: dict[str, Any]) -> str:
    """Plain-text email body for alert summary."""
    lines = [
        "Veelocity Alert Summary",
        "",
        f"Period: {payload['start_date']} to {payload['end_date']}",
        f"Active alerts: {payload['alert_count']}",
        "",
    ]
    for i, a in enumerate(payload["alerts"], 1):
        lines.append(f"{i}. [{a.get('severity', '')}] {a.get('title', '')}")
        lines.append(f"   {a.get('message', '')}")
        lines.append(f"   Metric: {a.get('metric', '')} | Current: {a.get('current_value')} | Threshold: {a.get('threshold', '')}")
        lines.append("")
    return "\n".join(lines)


async def send_alert_notifications(
    start_date: str,
    end_date: str,
    alerts: list[dict[str, Any]],
) -> None:
    """
    Send active alerts to configured webhooks and/or email.

    Only runs when alerts is non-empty. Webhook URLs and email are
    configured via environment (ALERT_WEBHOOK_URLS, ALERT_EMAIL_TO, SMTP_*).
    Errors are logged; no exceptions are raised.
    """
    if not alerts:
        return

    payload = _build_payload(start_date, end_date, alerts)

    # Webhooks: comma-separated URLs
    urls = [
        u.strip()
        for u in (settings.alert_webhook_urls or "").split(",")
        if u.strip()
    ]
    for url in urls:
        await _send_webhook(url, payload)

    # Email: optional
    to_addr = (settings.alert_email_to or "").strip()
    if to_addr and (settings.smtp_host or "").strip():
        subject = f"Veelocity: {len(alerts)} active alert(s)"
        body = _email_body(payload)
        await asyncio.to_thread(_send_email_sync, to_addr, subject, body)

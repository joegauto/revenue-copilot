"""Lógica de ventana de 24 horas de WhatsApp Business.

Si último mensaje del lead > 24h → usar exclusivamente plantillas aprobadas.
Si dentro de ventana 24h → enviar texto libre.

Valida: Requisito 6.4
"""

from datetime import datetime, timedelta, timezone
from dataclasses import dataclass


WINDOW_HOURS = 24


@dataclass
class WindowStatus:
    """Estado de la ventana de mensajería."""

    is_open: bool
    last_inbound_at: datetime | None
    hours_remaining: float
    must_use_template: bool


def check_window(last_inbound_at: datetime | None) -> WindowStatus:
    """Evalúa si la ventana de 24h está abierta.

    Args:
        last_inbound_at: Timestamp del último mensaje entrante del lead.

    Returns:
        WindowStatus con indicadores de ventana.
    """
    if last_inbound_at is None:
        return WindowStatus(
            is_open=False,
            last_inbound_at=None,
            hours_remaining=0,
            must_use_template=True,
        )

    now = datetime.now(timezone.utc)
    # Asegurar que last_inbound_at tiene timezone
    if last_inbound_at.tzinfo is None:
        last_inbound_at = last_inbound_at.replace(tzinfo=timezone.utc)

    elapsed = now - last_inbound_at
    window_duration = timedelta(hours=WINDOW_HOURS)

    if elapsed < window_duration:
        remaining = (window_duration - elapsed).total_seconds() / 3600
        return WindowStatus(
            is_open=True,
            last_inbound_at=last_inbound_at,
            hours_remaining=remaining,
            must_use_template=False,
        )

    return WindowStatus(
        is_open=False,
        last_inbound_at=last_inbound_at,
        hours_remaining=0,
        must_use_template=True,
    )

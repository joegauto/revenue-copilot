"""Property-based tests para ventana 24h de WhatsApp.

Property 12: Uso obligatorio de plantillas fuera de ventana 24h
- Mensajes con último contacto > 24h usan plantilla (must_use_template=True)
- Mensajes dentro de ventana 24h permiten texto libre (must_use_template=False)

Valida: Requisito 6.4
"""

import pytest
from datetime import datetime, timedelta, timezone
from hypothesis import given, settings
from hypothesis import strategies as st

from app.integrations.whatsapp_window import check_window, WINDOW_HOURS


@pytest.mark.pbt
class TestWhatsAppWindowProperties:
    """Property 12: Ventana 24h."""

    @settings(max_examples=200)
    @given(hours_ago=st.floats(min_value=24.001, max_value=720))
    def test_outside_window_requires_template(self, hours_ago):
        """Último contacto > 24h → must_use_template=True."""
        last_inbound = datetime.now(timezone.utc) - timedelta(hours=hours_ago)
        status = check_window(last_inbound)
        assert status.must_use_template is True
        assert status.is_open is False

    @settings(max_examples=200)
    @given(hours_ago=st.floats(min_value=0, max_value=23.99))
    def test_inside_window_allows_free_text(self, hours_ago):
        """Último contacto < 24h → must_use_template=False."""
        last_inbound = datetime.now(timezone.utc) - timedelta(hours=hours_ago)
        status = check_window(last_inbound)
        assert status.must_use_template is False
        assert status.is_open is True

    @settings(max_examples=200)
    @given(hours_ago=st.floats(min_value=0, max_value=23.99))
    def test_hours_remaining_positive_inside_window(self, hours_ago):
        """Dentro de ventana → hours_remaining > 0."""
        last_inbound = datetime.now(timezone.utc) - timedelta(hours=hours_ago)
        status = check_window(last_inbound)
        assert status.hours_remaining > 0

    def test_no_inbound_requires_template(self):
        """Sin último mensaje → debe usar plantilla."""
        status = check_window(None)
        assert status.must_use_template is True
        assert status.is_open is False

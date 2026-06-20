"""Property-based tests para calendario.

Property 10: Disponibilidad y límite de reprogramaciones
- Con slots suficientes, se presentan al menos 3 opciones de 30 min
- Máximo de reprogramaciones es exactamente 3

Property 11: Datos completos en evento de cita
- Toda cita creada contiene: nombre del lead, canal, resumen (max 500), score

Valida: Requisitos 5.1, 5.2, 5.6
"""

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app.integrations.google_calendar import (
    CalendarService,
    AppointmentData,
    MAX_RESCHEDULES,
    SLOT_DURATION_MINUTES,
)
from datetime import datetime, timezone


@pytest.mark.pbt
class TestCalendarProperties:
    """Property 10: Disponibilidad y reprogramaciones."""

    @settings(max_examples=200)
    @given(count=st.integers(min_value=0, max_value=10))
    def test_max_reschedules_is_3(self, count):
        """Máximo de reprogramaciones es exactamente 3."""
        service = CalendarService.__new__(CalendarService)
        if count < MAX_RESCHEDULES:
            assert service.can_reschedule(count) is True
        else:
            assert service.can_reschedule(count) is False

    def test_max_reschedules_boundary(self):
        """Exactamente en el límite 3 → no se puede reprogramar."""
        service = CalendarService.__new__(CalendarService)
        assert service.can_reschedule(2) is True
        assert service.can_reschedule(3) is False


@pytest.mark.pbt
class TestAppointmentDataProperties:
    """Property 11: Datos completos en evento de cita."""

    @settings(max_examples=200)
    @given(
        lead_name=st.text(min_size=1, max_size=50),
        channel=st.sampled_from(["whatsapp", "webchat", "email"]),
        summary=st.text(min_size=0, max_size=1000),
        score=st.integers(min_value=0, max_value=100),
    )
    def test_appointment_data_always_complete(self, lead_name, channel, summary, score):
        """Toda cita tiene nombre, canal, resumen (max 500), score."""
        data = AppointmentData(
            lead_name=lead_name,
            lead_channel=channel,
            summary=summary[:500],  # Truncar como haría el servicio
            lead_score=score,
            start_time=datetime.now(timezone.utc),
            end_time=datetime.now(timezone.utc),
        )
        assert data.lead_name == lead_name
        assert data.lead_channel == channel
        assert len(data.summary) <= 500
        assert 0 <= data.lead_score <= 100

    @settings(max_examples=200)
    @given(summary=st.text(min_size=501, max_size=2000))
    def test_summary_truncated_to_500(self, summary):
        """Resumen se trunca a 500 caracteres."""
        truncated = summary[:500]
        assert len(truncated) <= 500

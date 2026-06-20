"""Property-based tests para secuencias de seguimiento.

Property 8: Secuencias respetan límites temporales y de cantidad
- Pasos <= 3 (MVP), intervalos entre 1-72h
- Mensajes solo se programan dentro de ventana horaria
- Fuera de ventana se posponen al inicio de la siguiente

Property 9: Detención inmediata de secuencia al responder
- Si lead responde, secuencia se detiene

Valida: Requisitos 4.1, 4.2, 4.3, 4.6
"""

import pytest
from datetime import datetime, timedelta, timezone
from hypothesis import given, settings, assume
from hypothesis import strategies as st

from app.scheduler.sequence_scheduler import (
    validate_sequence,
    schedule_step,
    should_stop_sequence,
    is_within_business_hours,
    SequenceConfig,
    SequenceStep,
    MAX_STEPS,
    MIN_INTERVAL_HOURS,
    MAX_INTERVAL_HOURS,
)


@st.composite
def valid_steps(draw):
    """Genera pasos válidos (1-3, intervalos 1-72h)."""
    count = draw(st.integers(min_value=1, max_value=3))
    steps = []
    for i in range(count):
        steps.append(SequenceStep(
            step_number=i + 1,
            interval_hours=draw(st.integers(min_value=1, max_value=72)),
            message_template=f"Mensaje {i + 1}",
        ))
    return steps


@st.composite
def invalid_steps(draw):
    """Genera pasos que violan los límites."""
    # Más de 3 pasos O intervalos fuera de rango
    count = draw(st.integers(min_value=4, max_value=10))
    steps = []
    for i in range(count):
        steps.append(SequenceStep(
            step_number=i + 1,
            interval_hours=draw(st.integers(min_value=1, max_value=72)),
            message_template=f"Mensaje {i + 1}",
        ))
    return steps


@pytest.mark.pbt
class TestSequenceLimitsProperties:
    """Property 8: Secuencias respetan límites."""

    @settings(max_examples=200)
    @given(steps=valid_steps())
    def test_valid_sequence_passes_validation(self, steps):
        """Secuencias con <=3 pasos e intervalos 1-72h son válidas."""
        config = SequenceConfig(
            id="seq-1",
            tenant_id="t-1",
            name="Test",
            trigger_after_hours=24,
            steps=steps,
        )
        errors = validate_sequence(config)
        assert errors == []

    @settings(max_examples=200)
    @given(steps=invalid_steps())
    def test_too_many_steps_rejected(self, steps):
        """Secuencias con >3 pasos son rechazadas."""
        config = SequenceConfig(
            id="seq-1",
            tenant_id="t-1",
            name="Test",
            trigger_after_hours=24,
            steps=steps,
        )
        errors = validate_sequence(config)
        assert len(errors) > 0

    @settings(max_examples=200)
    @given(
        interval=st.integers(min_value=1, max_value=72),
        hour=st.integers(min_value=0, max_value=23),
    )
    def test_scheduled_within_business_hours(self, interval, hour):
        """Mensajes programados siempre caen dentro de ventana horaria."""
        config = SequenceConfig(
            id="seq-1",
            tenant_id="t-1",
            name="Test",
            trigger_after_hours=24,
            steps=[],
            business_hours_start=9,
            business_hours_end=18,
        )
        step = SequenceStep(step_number=1, interval_hours=interval, message_template="Hi")
        base = datetime(2026, 6, 16, hour, 0, tzinfo=timezone.utc)  # Lunes

        scheduled = schedule_step(config, step, base)
        assert is_within_business_hours(scheduled, 9, 18)


@pytest.mark.pbt
class TestSequenceStopProperties:
    """Property 9: Detención inmediata al responder."""

    @settings(max_examples=200)
    @given(responded=st.booleans())
    def test_stop_iff_responded(self, responded):
        """Secuencia se detiene si y solo si el lead respondió."""
        assert should_stop_sequence(responded) == responded

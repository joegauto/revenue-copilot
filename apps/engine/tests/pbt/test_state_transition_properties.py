"""Property-based tests para transiciones de estado de leads.

Property 6: Transición de estado por umbral de calificación
- Al cruzar umbral hacia arriba → estado "qualified"
- Al cruzar umbral hacia abajo (previamente qualified) → estado "in_progress"

Valida: Requisitos 2.3, 2.7
"""

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st

from app.scoring.state_machine import (
    evaluate_transition,
    mark_cold,
    LeadStatus,
    TransitionAction,
)


@pytest.mark.pbt
class TestStateTransitionProperties:
    """Property 6: Transición de estado por umbral."""

    @settings(max_examples=200)
    @given(
        score=st.integers(min_value=0, max_value=100),
        threshold=st.integers(min_value=1, max_value=99),
        status=st.sampled_from([LeadStatus.NEW, LeadStatus.IN_PROGRESS, LeadStatus.COLD]),
    )
    def test_crossing_up_qualifies(self, score, threshold, status):
        """Score >= threshold desde un estado no-qualified → qualified + conversion."""
        assume(score >= threshold)
        result = evaluate_transition(status, score, threshold)
        assert result.new_status == LeadStatus.QUALIFIED
        assert result.action == TransitionAction.CONVERSION
        assert result.changed is True

    @settings(max_examples=200)
    @given(
        score=st.integers(min_value=0, max_value=100),
        threshold=st.integers(min_value=1, max_value=99),
    )
    def test_crossing_down_downgrades(self, score, threshold):
        """Score < threshold desde qualified → in_progress + notify."""
        assume(score < threshold)
        result = evaluate_transition(LeadStatus.QUALIFIED, score, threshold)
        assert result.new_status == LeadStatus.IN_PROGRESS
        assert result.action == TransitionAction.NOTIFY_DOWNGRADE
        assert result.changed is True

    @settings(max_examples=200)
    @given(
        score=st.integers(min_value=0, max_value=100),
        threshold=st.integers(min_value=1, max_value=99),
    )
    def test_staying_qualified_no_action(self, score, threshold):
        """Score >= threshold ya siendo qualified → sin cambio."""
        assume(score >= threshold)
        result = evaluate_transition(LeadStatus.QUALIFIED, score, threshold)
        assert result.new_status == LeadStatus.QUALIFIED
        assert result.action is None
        assert result.changed is False

    @settings(max_examples=200)
    @given(
        score=st.integers(min_value=0, max_value=100),
        threshold=st.integers(min_value=1, max_value=99),
        status=st.sampled_from([LeadStatus.NEW, LeadStatus.IN_PROGRESS]),
    )
    def test_staying_below_no_action(self, score, threshold, status):
        """Score < threshold sin ser qualified → sin cambio."""
        assume(score < threshold)
        result = evaluate_transition(status, score, threshold)
        assert result.new_status == status
        assert result.action is None
        assert result.changed is False

    @settings(max_examples=200)
    @given(status=st.sampled_from(list(LeadStatus)))
    def test_mark_cold_always_cold(self, status):
        """mark_cold siempre transiciona a cold."""
        result = mark_cold(status)
        assert result.new_status == LeadStatus.COLD
        assert result.action == TransitionAction.NOTIFY_COLD

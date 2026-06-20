"""Property-based tests para cálculo de Lead Score.

Property 5: Cálculo correcto de Lead Score
- Para cualquier combinación válida de pesos (suma=100) y datos de lead,
  el score está entre 0 y 100
- Determinismo: mismo input = mismo output
- Pesos que no suman 100 son rechazados

Valida: Requisitos 2.2, 2.4, 2.5
"""

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st
from pydantic import ValidationError

from app.scoring.lead_scorer import LeadScorer, ScoringWeights


# ═══════════════════════════════════════════
# Strategies
# ═══════════════════════════════════════════

@st.composite
def valid_weights(draw):
    """Genera 4 pesos que suman exactamente 100, cada uno entre 0 y 100."""
    a = draw(st.integers(min_value=0, max_value=100))
    b = draw(st.integers(min_value=0, max_value=100 - a))
    c = draw(st.integers(min_value=0, max_value=100 - a - b))
    d = 100 - a - b - c
    return {
        "qualification_answers": a,
        "engagement": b,
        "demographics": c,
        "response_speed": d,
    }


@st.composite
def lead_data(draw):
    """Genera datos de lead arbitrarios pero razonables."""
    total_q = draw(st.integers(min_value=0, max_value=20))
    answers = draw(st.integers(min_value=0, max_value=max(total_q, 1)))
    if total_q == 0:
        answers = 0
    total_fields = draw(st.integers(min_value=0, max_value=10))
    matching = draw(st.integers(min_value=0, max_value=max(total_fields, 1)))
    if total_fields == 0:
        matching = 0
    return {
        "qualification_answers": answers,
        "total_questions": total_q,
        "total_messages": draw(st.integers(min_value=0, max_value=100)),
        "matching_fields": matching,
        "total_fields": total_fields,
        "avg_response_time_minutes": draw(st.floats(min_value=0, max_value=1440)),
        "current_score": draw(st.integers(min_value=0, max_value=100)),
    }


# ═══════════════════════════════════════════
# Property Tests
# ═══════════════════════════════════════════

@pytest.mark.pbt
class TestLeadScoreProperties:
    """Property 5: Cálculo correcto de Lead Score."""

    @settings(max_examples=200)
    @given(weights=valid_weights(), data=lead_data())
    def test_score_always_between_0_and_100(self, weights, data):
        """Para cualquier combinación válida, score ∈ [0, 100]."""
        scorer = LeadScorer({"scoring_weights": weights})
        result = scorer.calculate(data)
        assert 0 <= result.total_score <= 100

    @settings(max_examples=200)
    @given(weights=valid_weights(), data=lead_data())
    def test_deterministic_output(self, weights, data):
        """Mismo input siempre produce mismo output."""
        scorer = LeadScorer({"scoring_weights": weights})
        r1 = scorer.calculate(data)
        r2 = scorer.calculate(data)
        assert r1.total_score == r2.total_score
        assert r1.dimension_scores == r2.dimension_scores
        assert r1.qualified == r2.qualified
        assert r1.action_triggered == r2.action_triggered

    @settings(max_examples=200)
    @given(
        a=st.integers(min_value=0, max_value=100),
        b=st.integers(min_value=0, max_value=100),
        c=st.integers(min_value=0, max_value=100),
        d=st.integers(min_value=0, max_value=100),
    )
    def test_invalid_weights_rejected(self, a, b, c, d):
        """Pesos que no suman 100 son rechazados."""
        assume(a + b + c + d != 100)
        with pytest.raises(ValidationError):
            ScoringWeights(
                qualification_answers=a,
                engagement=b,
                demographics=c,
                response_speed=d,
            )

    @settings(max_examples=200)
    @given(weights=valid_weights(), data=lead_data())
    def test_dimension_scores_between_0_and_100(self, weights, data):
        """Cada dimensión individual ∈ [0, 100]."""
        scorer = LeadScorer({"scoring_weights": weights})
        result = scorer.calculate(data)
        for dim, score in result.dimension_scores.items():
            assert 0 <= score <= 100, f"{dim} = {score} fuera de rango"

    @settings(max_examples=200)
    @given(weights=valid_weights(), data=lead_data())
    def test_qualified_iff_above_threshold(self, weights, data):
        """qualified es True ↔ total_score >= threshold."""
        scorer = LeadScorer({"scoring_weights": weights})
        result = scorer.calculate(data)
        assert result.qualified == (result.total_score >= scorer.threshold)

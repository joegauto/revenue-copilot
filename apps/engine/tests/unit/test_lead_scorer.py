"""Unit tests para el motor de Lead Scoring.

Valida: Requisitos 2.2, 2.4
"""

import pytest
from pydantic import ValidationError

from app.scoring.lead_scorer import LeadScorer, LeadScoreResult, ScoringWeights


class TestScoringWeights:
    """Tests para validación de ScoringWeights."""

    def test_default_weights_sum_100(self):
        """Los pesos por defecto deben sumar 100."""
        weights = ScoringWeights()
        total = (
            weights.qualification_answers
            + weights.engagement
            + weights.demographics
            + weights.response_speed
        )
        assert total == 100

    def test_custom_weights_sum_100(self):
        """Pesos personalizados que suman 100 son válidos."""
        weights = ScoringWeights(
            qualification_answers=30,
            engagement=30,
            demographics=20,
            response_speed=20,
        )
        assert weights.qualification_answers == 30
        assert weights.engagement == 30
        assert weights.demographics == 20
        assert weights.response_speed == 20

    def test_weights_not_sum_100_raises_error(self):
        """Pesos que no suman 100 deben lanzar ValidationError."""
        with pytest.raises(ValidationError, match="Los pesos deben sumar 100"):
            ScoringWeights(
                qualification_answers=50,
                engagement=30,
                demographics=20,
                response_speed=20,
            )

    def test_weights_sum_less_than_100_raises_error(self):
        """Pesos que suman menos de 100 deben lanzar error."""
        with pytest.raises(ValidationError):
            ScoringWeights(
                qualification_answers=10,
                engagement=10,
                demographics=10,
                response_speed=10,
            )

    def test_weight_negative_raises_error(self):
        """Pesos negativos deben lanzar ValidationError."""
        with pytest.raises(ValidationError):
            ScoringWeights(
                qualification_answers=-10,
                engagement=40,
                demographics=40,
                response_speed=30,
            )

    def test_weight_over_100_raises_error(self):
        """Pesos mayores a 100 deben lanzar ValidationError."""
        with pytest.raises(ValidationError):
            ScoringWeights(
                qualification_answers=101,
                engagement=0,
                demographics=0,
                response_speed=0,
            )

    def test_all_weight_on_one_dimension(self):
        """Todo el peso en una dimensión es válido si suma 100."""
        weights = ScoringWeights(
            qualification_answers=100,
            engagement=0,
            demographics=0,
            response_speed=0,
        )
        assert weights.qualification_answers == 100


class TestLeadScorerInit:
    """Tests para inicialización del LeadScorer."""

    def test_default_config(self):
        """Inicialización con config vacía usa valores por defecto."""
        scorer = LeadScorer({})
        assert scorer.weights.qualification_answers == 40
        assert scorer.weights.engagement == 25
        assert scorer.weights.demographics == 20
        assert scorer.weights.response_speed == 15
        assert scorer.threshold == 60

    def test_custom_threshold(self):
        """Se puede configurar un umbral personalizado."""
        scorer = LeadScorer({"qualification_threshold": 75})
        assert scorer.threshold == 75

    def test_custom_weights(self):
        """Se pueden configurar pesos personalizados."""
        scorer = LeadScorer({
            "scoring_weights": {
                "qualification_answers": 50,
                "engagement": 20,
                "demographics": 15,
                "response_speed": 15,
            }
        })
        assert scorer.weights.qualification_answers == 50


class TestScoreQualification:
    """Tests para dimensión de calificación."""

    def setup_method(self):
        self.scorer = LeadScorer({})

    def test_all_questions_answered(self):
        """Todas las preguntas respondidas = 100."""
        score = self.scorer._score_qualification({
            "qualification_answers": 5,
            "total_questions": 5,
        })
        assert score == 100

    def test_no_questions_answered(self):
        """Sin respuestas = 0."""
        score = self.scorer._score_qualification({
            "qualification_answers": 0,
            "total_questions": 5,
        })
        assert score == 0

    def test_partial_answers(self):
        """3 de 5 preguntas = 60."""
        score = self.scorer._score_qualification({
            "qualification_answers": 3,
            "total_questions": 5,
        })
        assert score == 60

    def test_no_total_questions(self):
        """Sin preguntas configuradas = 0."""
        score = self.scorer._score_qualification({
            "qualification_answers": 3,
            "total_questions": 0,
        })
        assert score == 0

    def test_missing_data(self):
        """Datos faltantes = 0."""
        score = self.scorer._score_qualification({})
        assert score == 0


class TestScoreEngagement:
    """Tests para dimensión de engagement."""

    def setup_method(self):
        self.scorer = LeadScorer({})

    def test_high_engagement(self):
        """20 mensajes + todas las respuestas = 100."""
        score = self.scorer._score_engagement({
            "total_messages": 20,
            "qualification_answers": 5,
            "total_questions": 5,
        })
        assert score == 100

    def test_no_engagement(self):
        """Sin mensajes ni respuestas = 0."""
        score = self.scorer._score_engagement({
            "total_messages": 0,
            "qualification_answers": 0,
            "total_questions": 5,
        })
        assert score == 0

    def test_only_messages(self):
        """Solo mensajes, sin preguntas configuradas."""
        score = self.scorer._score_engagement({
            "total_messages": 10,
            "qualification_answers": 0,
            "total_questions": 0,
        })
        # message_score = min(100, (10/10)*50) = 50
        # answer_score = 0 (no questions)
        assert score == 50

    def test_message_score_caps_at_100(self):
        """El score de mensajes se limita a 100 (contribución max 50 pts del componente messages)."""
        score = self.scorer._score_engagement({
            "total_messages": 30,
            "qualification_answers": 5,
            "total_questions": 5,
        })
        # message_score = min(100, (30/10)*50) = 100
        # answer_score = min(50, (5/5)*50) = 50
        # total = 100 + 50 = 150 -> clamped to 100
        # Wait: message_score = min(100, 150) = 100, answer_score = 50, total = 150 -> clamped 100
        assert score == 100


class TestScoreDemographics:
    """Tests para dimensión demográfica."""

    def setup_method(self):
        self.scorer = LeadScorer({})

    def test_full_match(self):
        """Todos los campos coinciden = 100."""
        score = self.scorer._score_demographics({
            "matching_fields": 5,
            "total_fields": 5,
        })
        assert score == 100

    def test_no_match(self):
        """Sin campos coincidentes = 0."""
        score = self.scorer._score_demographics({
            "matching_fields": 0,
            "total_fields": 5,
        })
        assert score == 0

    def test_partial_match(self):
        """3 de 5 campos = 60."""
        score = self.scorer._score_demographics({
            "matching_fields": 3,
            "total_fields": 5,
        })
        assert score == 60

    def test_demographic_match_true(self):
        """demographic_match=True retorna 100 directamente."""
        score = self.scorer._score_demographics({
            "demographic_match": True,
        })
        assert score == 100

    def test_no_fields_configured(self):
        """Sin campos configurados = 0."""
        score = self.scorer._score_demographics({
            "matching_fields": 3,
            "total_fields": 0,
        })
        assert score == 0

    def test_missing_data(self):
        """Datos faltantes = 0."""
        score = self.scorer._score_demographics({})
        assert score == 0


class TestScoreResponseSpeed:
    """Tests para dimensión de velocidad de respuesta."""

    def setup_method(self):
        self.scorer = LeadScorer({})

    def test_under_2_minutes(self):
        """< 2 minutos = 100."""
        score = self.scorer._score_response_speed({
            "avg_response_time_minutes": 1,
        })
        assert score == 100

    def test_exactly_0_minutes(self):
        """0 minutos = 100."""
        score = self.scorer._score_response_speed({
            "avg_response_time_minutes": 0,
        })
        assert score == 100

    def test_between_2_and_10_minutes(self):
        """2-10 minutos = 67."""
        score = self.scorer._score_response_speed({
            "avg_response_time_minutes": 5,
        })
        assert score == 67

    def test_exactly_2_minutes(self):
        """Exactamente 2 minutos = 67 (está en el rango 2-10)."""
        score = self.scorer._score_response_speed({
            "avg_response_time_minutes": 2,
        })
        assert score == 67

    def test_between_10_and_60_minutes(self):
        """10-60 minutos = 33."""
        score = self.scorer._score_response_speed({
            "avg_response_time_minutes": 30,
        })
        assert score == 33

    def test_exactly_10_minutes(self):
        """Exactamente 10 minutos = 33 (está en el rango 10-60)."""
        score = self.scorer._score_response_speed({
            "avg_response_time_minutes": 10,
        })
        assert score == 33

    def test_over_60_minutes(self):
        """> 60 minutos = 0."""
        score = self.scorer._score_response_speed({
            "avg_response_time_minutes": 120,
        })
        assert score == 0

    def test_exactly_60_minutes(self):
        """Exactamente 60 minutos = 0 (está en el rango >60)."""
        score = self.scorer._score_response_speed({
            "avg_response_time_minutes": 60,
        })
        assert score == 0

    def test_missing_data_defaults_to_0(self):
        """Sin datos de velocidad = 0 (default 999 min)."""
        score = self.scorer._score_response_speed({})
        assert score == 0


class TestLeadScorerCalculate:
    """Tests para el cálculo completo del score."""

    def setup_method(self):
        self.scorer = LeadScorer({})

    def test_perfect_lead(self):
        """Lead perfecto en todas las dimensiones."""
        result = self.scorer.calculate({
            "qualification_answers": 5,
            "total_questions": 5,
            "total_messages": 20,
            "matching_fields": 5,
            "total_fields": 5,
            "avg_response_time_minutes": 1,
            "current_score": 0,
        })
        assert result.total_score == 100
        assert result.qualified is True
        assert result.dimension_scores["qualification"] == 100
        assert result.dimension_scores["engagement"] == 100
        assert result.dimension_scores["demographics"] == 100
        assert result.dimension_scores["response_speed"] == 100

    def test_zero_lead(self):
        """Lead sin datos = score 0."""
        result = self.scorer.calculate({
            "qualification_answers": 0,
            "total_questions": 5,
            "total_messages": 0,
            "matching_fields": 0,
            "total_fields": 5,
            "avg_response_time_minutes": 120,
            "current_score": 0,
        })
        assert result.total_score == 0
        assert result.qualified is False

    def test_score_formula_weighted(self):
        """Verifica la fórmula ponderada con pesos por defecto (40/25/20/15)."""
        result = self.scorer.calculate({
            "qualification_answers": 5,
            "total_questions": 5,
            "total_messages": 0,
            "matching_fields": 0,
            "total_fields": 5,
            "avg_response_time_minutes": 120,
            "current_score": 0,
        })
        # qualification=100, engagement=25 (answer_score=50, msg=0 -> 50? no: msg=0 -> 0, ans=5/5*50=50 -> 50)
        # Wait: engagement = min(100, (0/10)*50) + min(50, (5/5)*50) = 0 + 50 = 50
        # demographics=0, response_speed=0
        # total = 100*40/100 + 50*25/100 + 0*20/100 + 0*15/100 = 40 + 12.5 + 0 + 0 = 52.5 -> 52
        assert result.total_score == 52
        assert result.qualified is False

    def test_delta_calculation(self):
        """Delta = score actual - score previo."""
        result = self.scorer.calculate({
            "qualification_answers": 5,
            "total_questions": 5,
            "total_messages": 20,
            "matching_fields": 5,
            "total_fields": 5,
            "avg_response_time_minutes": 1,
            "current_score": 50,
        })
        assert result.delta == result.total_score - 50

    def test_qualified_when_above_threshold(self):
        """Lead se califica cuando score >= threshold."""
        result = self.scorer.calculate({
            "qualification_answers": 5,
            "total_questions": 5,
            "total_messages": 20,
            "matching_fields": 5,
            "total_fields": 5,
            "avg_response_time_minutes": 1,
            "current_score": 0,
        })
        assert result.qualified is True

    def test_not_qualified_when_below_threshold(self):
        """Lead no se califica cuando score < threshold."""
        scorer = LeadScorer({"qualification_threshold": 90})
        result = scorer.calculate({
            "qualification_answers": 2,
            "total_questions": 5,
            "total_messages": 3,
            "matching_fields": 1,
            "total_fields": 5,
            "avg_response_time_minutes": 30,
            "current_score": 0,
        })
        assert result.qualified is False

    def test_action_triggered_on_qualification(self):
        """Acción de conversión cuando lead cruza umbral hacia arriba."""
        result = self.scorer.calculate({
            "qualification_answers": 5,
            "total_questions": 5,
            "total_messages": 20,
            "matching_fields": 5,
            "total_fields": 5,
            "avg_response_time_minutes": 1,
            "current_score": 30,  # Estaba por debajo del umbral
        })
        assert result.action_triggered == "conversion_action"

    def test_action_triggered_on_downgrade(self):
        """Notificación cuando lead cae por debajo del umbral."""
        result = self.scorer.calculate({
            "qualification_answers": 0,
            "total_questions": 5,
            "total_messages": 0,
            "matching_fields": 0,
            "total_fields": 5,
            "avg_response_time_minutes": 120,
            "current_score": 70,  # Estaba calificado
        })
        assert result.action_triggered == "notify_downgrade"

    def test_no_action_when_stays_qualified(self):
        """Sin acción cuando lead se mantiene calificado."""
        result = self.scorer.calculate({
            "qualification_answers": 5,
            "total_questions": 5,
            "total_messages": 20,
            "matching_fields": 5,
            "total_fields": 5,
            "avg_response_time_minutes": 1,
            "current_score": 80,  # Ya estaba calificado
        })
        assert result.action_triggered is None

    def test_no_action_when_stays_unqualified(self):
        """Sin acción cuando lead se mantiene no calificado."""
        result = self.scorer.calculate({
            "qualification_answers": 0,
            "total_questions": 5,
            "total_messages": 0,
            "matching_fields": 0,
            "total_fields": 5,
            "avg_response_time_minutes": 120,
            "current_score": 10,  # Ya estaba por debajo
        })
        assert result.action_triggered is None

    def test_result_is_lead_score_result(self):
        """El resultado es una instancia de LeadScoreResult."""
        result = self.scorer.calculate({
            "qualification_answers": 3,
            "total_questions": 5,
            "total_messages": 5,
            "matching_fields": 2,
            "total_fields": 5,
            "avg_response_time_minutes": 5,
        })
        assert isinstance(result, LeadScoreResult)

    def test_score_clamped_to_0_100(self):
        """El score total siempre está entre 0 y 100."""
        result = self.scorer.calculate({
            "qualification_answers": 5,
            "total_questions": 5,
            "total_messages": 20,
            "matching_fields": 5,
            "total_fields": 5,
            "avg_response_time_minutes": 1,
            "current_score": 0,
        })
        assert 0 <= result.total_score <= 100

    def test_custom_weights_affect_score(self):
        """Pesos personalizados cambian el resultado."""
        # Todo el peso en velocidad de respuesta
        scorer = LeadScorer({
            "scoring_weights": {
                "qualification_answers": 0,
                "engagement": 0,
                "demographics": 0,
                "response_speed": 100,
            }
        })
        result = scorer.calculate({
            "qualification_answers": 5,
            "total_questions": 5,
            "total_messages": 20,
            "matching_fields": 5,
            "total_fields": 5,
            "avg_response_time_minutes": 5,  # 67 en velocidad
            "current_score": 0,
        })
        assert result.total_score == 67

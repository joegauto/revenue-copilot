"""Motor de Lead Scoring con 4 dimensiones configurables.

Calcula el score de un lead basado en:
1. Calificación (respuestas a preguntas)
2. Engagement (mensajes + respuestas)
3. Demografía (campos coincidentes)
4. Velocidad de respuesta (tiempo promedio)

Valida: Requisitos 2.2, 2.4
"""

from pydantic import BaseModel, Field, model_validator


class ScoringWeights(BaseModel):
    """Pesos de las 4 dimensiones de scoring. Deben sumar exactamente 100."""

    qualification_answers: int = Field(default=40, ge=0, le=100)
    engagement: int = Field(default=25, ge=0, le=100)
    demographics: int = Field(default=20, ge=0, le=100)
    response_speed: int = Field(default=15, ge=0, le=100)

    @model_validator(mode="after")
    def validate_total(self) -> "ScoringWeights":
        """Valida que los pesos sumen exactamente 100."""
        total = (
            self.qualification_answers
            + self.engagement
            + self.demographics
            + self.response_speed
        )
        if total != 100:
            raise ValueError(
                f"Los pesos deben sumar 100, pero suman {total}"
            )
        return self


class LeadScoreResult(BaseModel):
    """Resultado del cálculo de score de un lead."""

    total_score: int = Field(ge=0, le=100)
    dimension_scores: dict[str, int]
    previous_score: int = Field(default=0)
    delta: int = Field(default=0)
    qualified: bool = Field(default=False)
    action_triggered: str | None = Field(default=None)


class LeadScorer:
    """Motor de scoring que calcula el score de un lead en 4 dimensiones."""

    def __init__(self, tenant_config: dict):
        """Inicializa el scorer con la configuración del tenant.

        Args:
            tenant_config: Diccionario con 'scoring_weights' y 'qualification_threshold'.
        """
        self.weights = ScoringWeights(
            **tenant_config.get("scoring_weights", {})
        )
        self.threshold = tenant_config.get("qualification_threshold", 60)

    def calculate(self, lead_data: dict) -> LeadScoreResult:
        """Calcula el score total del lead basado en las 4 dimensiones.

        Fórmula: total = Σ (dimension_score_i × weight_i / 100)

        Args:
            lead_data: Datos del lead con campos necesarios para cada dimensión.

        Returns:
            LeadScoreResult con score total, desglose y estado de calificación.
        """
        scores = {
            "qualification": self._score_qualification(lead_data),
            "engagement": self._score_engagement(lead_data),
            "demographics": self._score_demographics(lead_data),
            "response_speed": self._score_response_speed(lead_data),
        }

        total = sum(
            scores[dim] * getattr(self.weights, dim_attr) / 100
            for dim, dim_attr in [
                ("qualification", "qualification_answers"),
                ("engagement", "engagement"),
                ("demographics", "demographics"),
                ("response_speed", "response_speed"),
            ]
        )

        # Clampar entre 0 y 100
        total = max(0, min(100, int(total)))

        previous_score = lead_data.get("current_score", 0)

        return LeadScoreResult(
            total_score=total,
            dimension_scores=scores,
            previous_score=previous_score,
            delta=total - previous_score,
            qualified=total >= self.threshold,
            action_triggered=self._determine_action(total, lead_data),
        )

    def _score_qualification(self, lead_data: dict) -> int:
        """Calcula score de calificación: (respuestas / total_preguntas) * 100.

        Returns:
            Score entre 0 y 100.
        """
        total_questions = lead_data.get("total_questions", 0)
        if total_questions <= 0:
            return 0
        answers = lead_data.get("qualification_answers", 0)
        score = (answers / total_questions) * 100
        return max(0, min(100, int(score)))

    def _score_engagement(self, lead_data: dict) -> int:
        """Calcula score de engagement basado en mensajes + respuestas.

        Fórmula:
            message_score = min(100, (total_messages / 10) * 50)  -> max 50 pts
            answer_score = min(50, (qualification_answers / total_questions) * 50)
            engagement_score = message_score + answer_score

        Returns:
            Score entre 0 y 100.
        """
        total_messages = lead_data.get("total_messages", 0)
        message_score = min(100, (total_messages / 10) * 50)

        total_questions = lead_data.get("total_questions", 0)
        answers = lead_data.get("qualification_answers", 0)

        if total_questions > 0:
            answer_score = min(50, (answers / total_questions) * 50)
        else:
            answer_score = 0

        engagement_score = message_score + answer_score
        return max(0, min(100, int(engagement_score)))

    def _score_demographics(self, lead_data: dict) -> int:
        """Calcula score demográfico: (campos_coincidentes / total_campos) * 100.

        Si demographic_match es True directamente, retorna 100.

        Returns:
            Score entre 0 y 100.
        """
        # Atajo: si hay un match directo
        if lead_data.get("demographic_match") is True:
            return 100

        matching_fields = lead_data.get("matching_fields", 0)
        total_fields = lead_data.get("total_fields", 0)

        if total_fields <= 0:
            return 0

        score = (matching_fields / total_fields) * 100
        return max(0, min(100, int(score)))

    def _score_response_speed(self, lead_data: dict) -> int:
        """Calcula score de velocidad de respuesta.

        Escala:
            < 2 minutos  → 100
            2-10 minutos → 67
            10-60 minutos → 33
            > 60 minutos → 0

        Returns:
            Score: 0, 33, 67 o 100.
        """
        avg_minutes = lead_data.get("avg_response_time_minutes", 999)
        if avg_minutes < 2:
            return 100
        if avg_minutes < 10:
            return 67
        if avg_minutes < 60:
            return 33
        return 0

    def _determine_action(self, total_score: float, lead_data: dict) -> str | None:
        """Determina la acción a ejecutar basada en el score y estado previo.

        Returns:
            Nombre de la acción o None si no se requiere acción.
        """
        previous_score = lead_data.get("current_score", 0)
        was_qualified = previous_score >= self.threshold

        if total_score >= self.threshold and not was_qualified:
            return "conversion_action"
        if total_score < self.threshold and was_qualified:
            return "notify_downgrade"
        return None

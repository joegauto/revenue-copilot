"""Router FastAPI para operaciones de scoring.

Endpoints:
  POST /engine/calculate-score — Recalcula score de un lead.

Valida: Requisito 2.4
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.scoring.lead_scorer import LeadScorer, LeadScoreResult
from app.scoring.state_machine import evaluate_transition, StateTransition

router = APIRouter(prefix="/engine", tags=["scoring"])


class CalculateScoreRequest(BaseModel):
    """Payload para recalcular score de un lead."""

    tenant_id: str
    lead_id: str
    lead_data: dict
    tenant_config: dict = Field(default_factory=dict)


class CalculateScoreResponse(BaseModel):
    """Respuesta con score recalculado y transición de estado."""

    lead_id: str
    score: LeadScoreResult
    transition: StateTransition | None = None


@router.post("/calculate-score", response_model=CalculateScoreResponse)
async def calculate_score(request: CalculateScoreRequest) -> CalculateScoreResponse:
    """Recalcula el score de un lead y evalúa transiciones de estado.

    Debe completar en <5 segundos (SLA del requisito 2.4).
    En producción, guarda ScoreHistory y aplica la transición en DB.
    """
    scorer = LeadScorer(request.tenant_config)
    result = scorer.calculate(request.lead_data)

    # Evaluar transición de estado
    current_status = request.lead_data.get("status", "new")
    transition = evaluate_transition(
        current_status=current_status,
        new_score=result.total_score,
        threshold=scorer.threshold,
    )

    # ponytail: persistencia a DB y ScoreHistory se conecta en task 19 (wiring)
    # Por ahora retorna el cálculo puro.

    return CalculateScoreResponse(
        lead_id=request.lead_id,
        score=result,
        transition=transition if transition.changed else None,
    )

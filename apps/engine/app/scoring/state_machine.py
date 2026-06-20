"""Máquina de estados para transiciones de leads por umbral de scoring.

Estados posibles: new → in_progress → qualified → cold
Transiciones:
  - Score >= umbral → "qualified" + acción de conversión
  - Score < umbral (previamente qualified) → "in_progress" + notificar
  - Secuencia completa sin respuesta → "cold" + notificar

Valida: Requisitos 2.3, 2.7
"""

from dataclasses import dataclass
from enum import StrEnum


class LeadStatus(StrEnum):
    NEW = "new"
    IN_PROGRESS = "in_progress"
    QUALIFIED = "qualified"
    COLD = "cold"


class TransitionAction(StrEnum):
    CONVERSION = "conversion_action"
    NOTIFY_DOWNGRADE = "notify_downgrade"
    NOTIFY_COLD = "notify_cold"


@dataclass
class StateTransition:
    """Resultado de evaluar una transición de estado."""

    previous_status: str
    new_status: str
    action: TransitionAction | None = None
    changed: bool = False


def evaluate_transition(
    current_status: str,
    new_score: int,
    threshold: int,
) -> StateTransition:
    """Evalúa si el lead debe cambiar de estado basado en su nuevo score.

    Args:
        current_status: Estado actual del lead.
        new_score: Score recién calculado.
        threshold: Umbral de calificación del tenant.

    Returns:
        StateTransition con nuevo estado y acción (si aplica).
    """
    if new_score >= threshold and current_status != LeadStatus.QUALIFIED:
        return StateTransition(
            previous_status=current_status,
            new_status=LeadStatus.QUALIFIED,
            action=TransitionAction.CONVERSION,
            changed=True,
        )

    if new_score < threshold and current_status == LeadStatus.QUALIFIED:
        return StateTransition(
            previous_status=current_status,
            new_status=LeadStatus.IN_PROGRESS,
            action=TransitionAction.NOTIFY_DOWNGRADE,
            changed=True,
        )

    # ponytail: no cambia de estado si se mantiene en el mismo rango
    return StateTransition(
        previous_status=current_status,
        new_status=current_status,
        action=None,
        changed=False,
    )


def mark_cold(current_status: str) -> StateTransition:
    """Marca un lead como frío tras secuencia completa sin respuesta.

    Args:
        current_status: Estado actual del lead.

    Returns:
        StateTransition al estado cold.
    """
    return StateTransition(
        previous_status=current_status,
        new_status=LeadStatus.COLD,
        action=TransitionAction.NOTIFY_COLD,
        changed=current_status != LeadStatus.COLD,
    )

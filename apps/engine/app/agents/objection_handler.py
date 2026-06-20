"""Manejo de objeciones y lógica de escalación.

Detecta objeciones (precio, necesidad, urgencia, confianza) y genera
estrategias de respuesta basadas en la KB del tenant.

Si no puede responder → escalación a humano con notificación en 60s.

Valida: Requisitos 3.4, 3.5, 3.6, 3.7
"""

from dataclasses import dataclass
from app.agents.commercial_agent import Intent


@dataclass
class ObjectionStrategy:
    """Estrategia para manejar una objeción."""

    objection_type: str
    approach: str
    escalate: bool = False
    notify_tenant: bool = False


# ponytail: tabla estática de estrategias. Upgrade: generarlas con LLM + KB.
OBJECTION_STRATEGIES: dict[Intent, ObjectionStrategy] = {
    Intent.OBJECION_PRECIO: ObjectionStrategy(
        objection_type="precio",
        approach="Resalta el valor y ROI. Ofrece comparar con alternativas. Menciona opciones de pago si existen en la KB.",
    ),
    Intent.OBJECION_NECESIDAD: ObjectionStrategy(
        objection_type="necesidad",
        approach="Pregunta sobre sus problemas actuales. Conecta el producto con la solución a esos problemas específicos.",
    ),
    Intent.OBJECION_URGENCIA: ObjectionStrategy(
        objection_type="urgencia",
        approach="Valida que no es buen momento. Ofrece agendar para más adelante. Menciona beneficios de actuar pronto si aplica.",
    ),
    Intent.OBJECION_CONFIANZA: ObjectionStrategy(
        objection_type="confianza",
        approach="Comparte testimonios, casos de éxito o garantías de la KB. Si no hay suficiente info, escalar.",
        escalate=False,
        notify_tenant=True,
    ),
}


def get_objection_strategy(intent: Intent) -> ObjectionStrategy | None:
    """Retorna la estrategia de manejo para una objeción detectada.

    Args:
        intent: Intención detectada.

    Returns:
        ObjectionStrategy o None si no es una objeción.
    """
    return OBJECTION_STRATEGIES.get(intent)


def should_escalate_to_human(intent: Intent, kb_has_answer: bool) -> bool:
    """Determina si se debe escalar a un humano.

    Escala cuando:
    1. Tema fuera de alcance que no se puede redirigir
    2. Objeción de confianza sin info suficiente en KB
    3. No hay respuesta en la KB para la pregunta del lead

    Args:
        intent: Intención del mensaje.
        kb_has_answer: Si la KB tiene información relevante.

    Returns:
        True si se requiere escalación.
    """
    if intent == Intent.FUERA_ALCANCE:
        return True

    if intent == Intent.OBJECION_CONFIANZA and not kb_has_answer:
        return True

    if intent == Intent.PREGUNTA_PRODUCTO and not kb_has_answer:
        return True

    return False

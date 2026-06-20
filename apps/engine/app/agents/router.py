"""Router FastAPI para procesamiento de mensajes del agente comercial.

Endpoint principal: POST /engine/process-message
Orquesta: agente + scoring + acciones.

Valida: Requisitos 3.8, 1.1, 1.2
"""

import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Any

import httpx

router = APIRouter(prefix="/engine", tags=["agent"])


class ProcessMessageRequest(BaseModel):
    """Payload para procesar un mensaje entrante."""

    tenant_id: str
    lead_id: str
    conversation_id: str
    channel: str
    message: str
    message_type: str = "text"
    history: list[dict[str, str]] = Field(default_factory=list)
    lead_context: dict[str, Any] = Field(default_factory=dict)
    tenant_config: dict[str, Any] = Field(default_factory=dict)


class ProcessMessageResponse(BaseModel):
    """Respuesta del engine tras procesar un mensaje."""

    response: str
    intent: str
    score: int | None = None
    score_delta: int | None = None
    action: str | None = None
    escalate: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)


# Configuración del LLM — se lee dentro de la función para que Render la inyecte
BASE_URL = "https://openrouter.ai/api/v1"

SYSTEM_PROMPT = """Eres un agente comercial virtual inteligente.
Tu objetivo es calificar leads, responder preguntas sobre el negocio, y guiarlos hacia una conversión.

REGLAS:
1. Máximo 300 palabras por respuesta. Sé conciso y directo.
2. Tono: profesional pero cercano.
3. Si te preguntan algo que no sabés, decí honestamente que no tenés esa info y ofrecé conectar con un humano.
4. Si detectás interés de compra, sugerí agendar una cita/demo.
5. Redirigí temas fuera del ámbito comercial hacia lo comercial.
6. Respondé en el mismo idioma que el cliente.

CONTEXTO DEL LEAD:
- Score actual: {score}/100
- Estado: {status}
- Canal: {channel}
"""


async def call_llm(message: str, history: list[dict], lead_context: dict) -> str:
    """Llama al LLM via OpenRouter."""
    api_key = os.getenv("ENGINE_LLM_API_KEY", "").strip()
    model = os.getenv("ENGINE_LLM_MODEL", "meta-llama/llama-3.1-8b-instruct").strip()

    if not api_key:
        return "El agente IA no está configurado. Configura ENGINE_LLM_API_KEY."

    messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT.format(
                score=lead_context.get("current_score", 0),
                status=lead_context.get("status", "new"),
                channel=lead_context.get("channel", "web"),
            ),
        }
    ]

    # Agregar historial (últimos 10 mensajes)
    for msg in history[-10:]:
        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})

    # Agregar mensaje actual
    messages.append({"role": "user", "content": message})

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": messages,
                    "max_tokens": 500,
                    "temperature": 0.7,
                },
            )

            if response.status_code != 200:
                return f"Error del LLM ({response.status_code}). Intenta de nuevo."

            data = response.json()
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        return f"Error de conexión con el LLM: {str(e)[:100]}"


@router.post("/process-message", response_model=ProcessMessageResponse)
async def process_message(request: ProcessMessageRequest) -> ProcessMessageResponse:
    """Procesa un mensaje del lead: genera respuesta IA + recalcula score."""
    from app.scoring.lead_scorer import LeadScorer
    from app.scoring.state_machine import evaluate_transition

    # 1. Recalcular score
    scorer = LeadScorer(request.tenant_config)
    score_result = scorer.calculate(request.lead_context)

    # 2. Evaluar transición de estado
    current_status = request.lead_context.get("status", "new")
    transition = evaluate_transition(
        current_status=current_status,
        new_score=score_result.total_score,
        threshold=scorer.threshold,
    )

    action = transition.action if transition.changed else None

    # 3. Generar respuesta con LLM real
    response_text = await call_llm(
        message=request.message,
        history=request.history,
        lead_context=request.lead_context,
    )

    # 4. Detectar intent básico
    intent = detect_basic_intent(request.message)

    return ProcessMessageResponse(
        response=response_text,
        intent=intent,
        score=score_result.total_score,
        score_delta=score_result.delta,
        action=action,
        escalate=intent == "fuera_alcance",
        metadata={
            "dimension_scores": score_result.dimension_scores,
            "qualified": score_result.qualified,
            "model": os.getenv("ENGINE_LLM_MODEL", "meta-llama/llama-3.1-8b-instruct"),
        },
    )


def detect_basic_intent(message: str) -> str:
    """Detección de intent simple basada en keywords."""
    msg = message.lower()
    if any(w in msg for w in ["precio", "costo", "cuánto", "cuanto", "vale"]):
        return "pregunta_producto"
    if any(w in msg for w in ["caro", "costoso", "descuento", "rebaja"]):
        return "objecion_precio"
    if any(w in msg for w in ["cita", "reunión", "agenda", "disponibilidad"]):
        return "acepta_cita"
    if any(w in msg for w in ["comprar", "contratar", "quiero", "interesa"]):
        return "interes_compra"
    if any(w in msg for w in ["hola", "buenas", "buen día"]):
        return "saludo"
    if any(w in msg for w in ["gracias", "chau", "adiós"]):
        return "despedida"
    return "otro"

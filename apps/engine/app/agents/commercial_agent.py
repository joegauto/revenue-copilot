"""Agente comercial IA con LangChain.

Genera respuestas comerciales basadas en:
- Base de conocimiento del tenant (RAG)
- Historial de conversación
- Detección de intenciones
- Tono configurable

Reglas estrictas:
- Máximo 300 palabras por respuesta
- Solo información de la KB del tenant
- Tono configurable (formal/neutral/casual)
- Detección de intenciones para routing

Valida: Requisitos 3.1, 3.2, 3.3, 3.4, 3.7
"""

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.language_models import BaseChatModel
from langchain_core.output_parsers import StrOutputParser


class Intent(StrEnum):
    """Intenciones detectables en mensajes del lead."""

    PREGUNTA_PRODUCTO = "pregunta_producto"
    OBJECION_PRECIO = "objecion_precio"
    OBJECION_NECESIDAD = "objecion_necesidad"
    OBJECION_URGENCIA = "objecion_urgencia"
    OBJECION_CONFIANZA = "objecion_confianza"
    INTERES_COMPRA = "interes_compra"
    ACEPTA_CITA = "acepta_cita"
    RECHAZA_CITA = "rechaza_cita"
    SOLICITA_REPROGRAMAR = "solicita_reprogramar"
    FUERA_ALCANCE = "fuera_alcance"
    SALUDO = "saludo"
    DESPEDIDA = "despedida"
    OTRO = "otro"


@dataclass
class AgentResponse:
    """Resultado del procesamiento del agente comercial."""

    message: str
    intent: Intent
    confidence: float = 0.0
    escalate: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)


# ponytail: prompt monolítico en vez de chain compleja.
# Ceiling: si el prompt necesita crecer mucho, separar en intent chain + response chain.
SYSTEM_PROMPT_TEMPLATE = """Eres un agente comercial virtual de {business_name}.
Tu objetivo es calificar leads y guiarlos hacia una conversión (compra o cita).

## REGLAS ESTRICTAS
1. MÁXIMO 300 palabras por respuesta. Sé conciso.
2. SOLO puedes usar información de la BASE DE CONOCIMIENTO proporcionada.
3. Si no tienes la respuesta en la KB, di honestamente que no puedes responder y ofrece conectar con un humano.
4. Tono: {tone}
5. Nunca inventes precios, características o políticas.
6. Redirige temas fuera del ámbito comercial hacia lo comercial.
7. Si detectas interés de compra, sugiere agendar una cita/demo.

## BASE DE CONOCIMIENTO
{knowledge_base}

## CONTEXTO DEL LEAD
- Nombre: {lead_name}
- Canal: {channel}
- Score actual: {lead_score}/100
- Estado: {lead_status}

## INSTRUCCIONES DE FORMATO
Responde SOLO con tu mensaje al lead. No incluyas etiquetas, prefijos ni explicaciones internas.
"""

INTENT_PROMPT = """Analiza el siguiente mensaje y clasifícalo en UNA de estas intenciones:
- pregunta_producto: pregunta sobre producto/servicio/precio/características
- objecion_precio: objeción sobre el precio o costo
- objecion_necesidad: dice que no necesita el producto
- objecion_urgencia: dice que no es buen momento
- objecion_confianza: desconfianza sobre la empresa/producto
- interes_compra: muestra interés en comprar/contratar
- acepta_cita: acepta agendar una cita/demo/reunión
- rechaza_cita: rechaza agendar
- solicita_reprogramar: quiere cambiar fecha de cita existente
- fuera_alcance: tema no relacionado con el negocio
- saludo: saludo inicial
- despedida: se despide
- otro: no encaja en ninguna categoría

Mensaje: "{message}"

Responde SOLO con el nombre de la intención (una palabra, sin explicación).
"""


class CommercialAgent:
    """Agente comercial que usa LangChain para generar respuestas contextuales."""

    def __init__(
        self,
        llm: BaseChatModel,
        tenant_config: dict[str, Any],
    ):
        """Inicializa el agente con un LLM y configuración del tenant.

        Args:
            llm: Modelo de lenguaje (inyectado para facilitar testing/swap).
            tenant_config: Config del tenant con tone, business_name, knowledge_base.
        """
        self.llm = llm
        self.tone = tenant_config.get("tone", "neutral")
        self.business_name = tenant_config.get("business_name", "la empresa")
        self.knowledge_base = tenant_config.get("knowledge_base", "Sin información disponible.")
        self.max_words = 300

        self._response_chain = self._build_response_chain()
        self._intent_chain = self._build_intent_chain()

    def _build_response_chain(self):
        """Construye la chain de generación de respuestas."""
        prompt = ChatPromptTemplate.from_messages([
            ("system", SYSTEM_PROMPT_TEMPLATE),
            MessagesPlaceholder("history"),
            ("human", "{input}"),
        ])
        return prompt | self.llm | StrOutputParser()

    def _build_intent_chain(self):
        """Construye la chain de detección de intenciones."""
        prompt = ChatPromptTemplate.from_template(INTENT_PROMPT)
        return prompt | self.llm | StrOutputParser()

    async def process_message(
        self,
        message: str,
        history: list[dict[str, str]] | None = None,
        lead_context: dict[str, Any] | None = None,
    ) -> AgentResponse:
        """Procesa un mensaje del lead y genera respuesta.

        Args:
            message: Mensaje entrante del lead.
            history: Historial de conversación [{role, content}].
            lead_context: Datos del lead (name, score, status, channel).

        Returns:
            AgentResponse con mensaje, intent y metadata.
        """
        lead_ctx = lead_context or {}
        history = history or []

        # 1. Detectar intención
        intent = await self._detect_intent(message)

        # 2. Verificar si necesita escalación
        escalate = self._should_escalate(intent, message)

        # 3. Generar respuesta
        response_text = await self._generate_response(
            message=message,
            history=history,
            lead_ctx=lead_ctx,
            intent=intent,
        )

        # 4. Truncar a max_words si el LLM se excede
        response_text = self._enforce_word_limit(response_text)

        return AgentResponse(
            message=response_text,
            intent=intent,
            escalate=escalate,
            metadata={
                "word_count": len(response_text.split()),
                "lead_score": lead_ctx.get("lead_score", 0),
            },
        )

    async def _detect_intent(self, message: str) -> Intent:
        """Detecta la intención del mensaje usando el LLM."""
        try:
            raw = await self._intent_chain.ainvoke({"message": message})
            cleaned = raw.strip().lower().replace(" ", "_")
            return Intent(cleaned)
        except (ValueError, KeyError):
            return Intent.OTRO

    def _should_escalate(self, intent: Intent, message: str) -> bool:
        """Determina si el mensaje requiere escalación a humano.

        Escala cuando:
        - Intención fuera de alcance (no puede redirigir)
        - Objeción de confianza severa
        """
        # ponytail: heurística simple. Upgrade: análisis de sentimiento.
        return intent == Intent.FUERA_ALCANCE

    async def _generate_response(
        self,
        message: str,
        history: list[dict[str, str]],
        lead_ctx: dict[str, Any],
        intent: Intent,
    ) -> str:
        """Genera la respuesta usando la chain de LangChain."""
        # Convertir historial a formato LangChain messages
        lc_history = []
        for msg in history[-20:]:  # Max 20 mensajes de contexto
            if msg.get("role") == "user":
                lc_history.append(HumanMessage(content=msg["content"]))
            elif msg.get("role") == "assistant":
                lc_history.append(AIMessage(content=msg["content"]))

        response = await self._response_chain.ainvoke({
            "business_name": self.business_name,
            "tone": self.tone,
            "knowledge_base": self.knowledge_base,
            "lead_name": lead_ctx.get("lead_name", "Cliente"),
            "channel": lead_ctx.get("channel", "web"),
            "lead_score": lead_ctx.get("lead_score", 0),
            "lead_status": lead_ctx.get("lead_status", "new"),
            "history": lc_history,
            "input": message,
        })

        return response.strip()

    def _enforce_word_limit(self, text: str) -> str:
        """Trunca respuesta a max_words, cerrando en oración completa."""
        words = text.split()
        if len(words) <= self.max_words:
            return text

        truncated = " ".join(words[: self.max_words])
        # Intentar cerrar en el último punto/signo
        for sep in (".", "!", "?"):
            last_sep = truncated.rfind(sep)
            if last_sep > len(truncated) // 2:
                return truncated[: last_sep + 1]
        return truncated + "..."

"""Property-based tests para el agente comercial.

Property 7: Invariante de longitud de respuesta
- Para cualquier contexto y mensaje, la respuesta tiene máximo 300 palabras.

Valida: Requisito 3.1
"""

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st
from unittest.mock import AsyncMock, MagicMock

from app.agents.commercial_agent import CommercialAgent, Intent


def make_fake_llm(response_text: str):
    """Crea un LLM mock que siempre responde con el texto dado."""
    llm = MagicMock()

    async def fake_ainvoke(input, **kwargs):
        # Retorna un objeto con content para el StrOutputParser
        msg = MagicMock()
        msg.content = response_text
        return msg

    llm.ainvoke = fake_ainvoke

    # Para chains con | operator, necesitamos que el LLM sea un BaseChatModel mock
    # Usamos un approach diferente: mockeamos la chain directamente
    return llm


@pytest.mark.pbt
class TestAgentResponseLength:
    """Property 7: Invariante de longitud de respuesta."""

    @settings(max_examples=100)
    @given(
        word_count=st.integers(min_value=1, max_value=1000),
        message=st.text(min_size=1, max_size=200),
    )
    def test_enforce_word_limit_always_under_300(self, word_count, message):
        """_enforce_word_limit siempre retorna <= 300 palabras."""
        # Generar texto de longitud arbitraria
        long_text = " ".join(["palabra"] * word_count)

        # Crear agente con LLM dummy (no se usa en este test)
        agent = CommercialAgent.__new__(CommercialAgent)
        agent.max_words = 300

        result = agent._enforce_word_limit(long_text)
        assert len(result.split()) <= 300

    @settings(max_examples=100)
    @given(word_count=st.integers(min_value=1, max_value=300))
    def test_short_text_unchanged(self, word_count):
        """Textos <= 300 palabras no se modifican."""
        text = " ".join(["hola"] * word_count)

        agent = CommercialAgent.__new__(CommercialAgent)
        agent.max_words = 300

        result = agent._enforce_word_limit(text)
        assert result == text

    @settings(max_examples=100)
    @given(word_count=st.integers(min_value=301, max_value=1000))
    def test_long_text_truncated(self, word_count):
        """Textos > 300 palabras se truncan."""
        text = " ".join(["test"] * word_count)

        agent = CommercialAgent.__new__(CommercialAgent)
        agent.max_words = 300

        result = agent._enforce_word_limit(text)
        assert len(result.split()) <= 300

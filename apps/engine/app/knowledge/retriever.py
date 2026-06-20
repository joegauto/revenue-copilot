"""Pipeline RAG para búsqueda semántica en la KB del tenant.

Indexa KnowledgeEntry del tenant y busca por similitud semántica
para proporcionar contexto al agente comercial.

Valida: Requisitos 3.2, 9.2
"""

from dataclasses import dataclass
from typing import Any

from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_community.vectorstores import FAISS


@dataclass
class RetrievedContext:
    """Resultado de búsqueda en la KB."""

    documents: list[Document]
    combined_text: str
    source_count: int


class KnowledgeRetriever:
    """Retriever que busca en la base de conocimiento del tenant por embeddings.

    Usa FAISS como vector store in-memory por tenant.
    """

    def __init__(self, embeddings: Embeddings):
        """Inicializa con un modelo de embeddings.

        Args:
            embeddings: Modelo de embeddings (OpenAI, HuggingFace, etc.)
        """
        self.embeddings = embeddings
        self._stores: dict[str, FAISS] = {}

    async def index_entries(
        self,
        tenant_id: str,
        entries: list[dict[str, Any]],
    ) -> int:
        """Indexa las entradas de KB de un tenant.

        Args:
            tenant_id: ID del tenant.
            entries: Lista de {content, title, category, source_type}.

        Returns:
            Cantidad de documentos indexados.
        """
        if not entries:
            return 0

        documents = [
            Document(
                page_content=entry["content"],
                metadata={
                    "title": entry.get("title", ""),
                    "category": entry.get("category", "general"),
                    "source_type": entry.get("source_type", "manual"),
                    "tenant_id": tenant_id,
                },
            )
            for entry in entries
        ]

        self._stores[tenant_id] = await FAISS.afrom_documents(
            documents, self.embeddings
        )
        return len(documents)

    async def search(
        self,
        tenant_id: str,
        query: str,
        k: int = 4,
    ) -> RetrievedContext:
        """Busca documentos relevantes en la KB del tenant.

        Args:
            tenant_id: ID del tenant.
            query: Texto de búsqueda.
            k: Número de documentos a retornar.

        Returns:
            RetrievedContext con documentos y texto combinado.
        """
        store = self._stores.get(tenant_id)
        if not store:
            return RetrievedContext(documents=[], combined_text="", source_count=0)

        docs = await store.asimilarity_search(query, k=k)

        combined = "\n\n".join(
            f"[{doc.metadata.get('title', 'Info')}]: {doc.page_content}"
            for doc in docs
        )

        return RetrievedContext(
            documents=docs,
            combined_text=combined,
            source_count=len(docs),
        )

    def has_knowledge(self, tenant_id: str) -> bool:
        """Verifica si un tenant tiene KB indexada."""
        return tenant_id in self._stores and self._stores[tenant_id] is not None

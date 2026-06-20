"""Cliente WhatsApp Business Cloud API.

Implementa envío de mensajes con retry exponencial y soporte
para múltiples tipos de contenido.

Valida: Requisitos 6.1, 6.2, 6.3, 6.5
"""

import asyncio
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

import httpx


class MessageType(StrEnum):
    TEXT = "text"
    IMAGE = "image"
    DOCUMENT = "document"
    AUDIO = "audio"
    LOCATION = "location"
    TEMPLATE = "template"


@dataclass
class SendResult:
    """Resultado de envío de mensaje."""

    success: bool
    message_id: str | None = None
    error: str | None = None
    retries: int = 0


class WhatsAppClient:
    """Cliente para WhatsApp Business Cloud API con retry exponencial."""

    BASE_URL = "https://graph.facebook.com/v18.0"
    MAX_RETRIES = 3
    BACKOFF_SECONDS = [1, 2, 4]

    def __init__(self, phone_number_id: str, access_token: str):
        """Inicializa con credenciales de WhatsApp Business.

        Args:
            phone_number_id: ID del número de teléfono en Meta Business.
            access_token: Token de acceso permanente o temporal.
        """
        self.phone_number_id = phone_number_id
        self.access_token = access_token
        self._client = httpx.AsyncClient(
            base_url=f"{self.BASE_URL}/{phone_number_id}",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10.0,
        )

    async def send_text(self, to: str, body: str) -> SendResult:
        """Envía un mensaje de texto.

        Args:
            to: Número de teléfono destino (formato internacional sin +).
            body: Contenido del mensaje.
        """
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "text",
            "text": {"body": body},
        }
        return await self._send_with_retry(payload)

    async def send_template(
        self, to: str, template_name: str, language: str = "es", components: list | None = None
    ) -> SendResult:
        """Envía un mensaje usando plantilla aprobada (para fuera de ventana 24h).

        Args:
            to: Número destino.
            template_name: Nombre de la plantilla aprobada.
            language: Código de idioma.
            components: Componentes de la plantilla (header, body params).
        """
        payload: dict[str, Any] = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language},
            },
        }
        if components:
            payload["template"]["components"] = components
        return await self._send_with_retry(payload)

    async def send_media(
        self, to: str, media_type: MessageType, media_url: str, caption: str | None = None
    ) -> SendResult:
        """Envía imagen, documento o audio.

        Args:
            to: Número destino.
            media_type: Tipo de media (image, document, audio).
            media_url: URL del archivo.
            caption: Texto acompañante (opcional).
        """
        media_payload: dict[str, str] = {"link": media_url}
        if caption:
            media_payload["caption"] = caption

        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": media_type.value,
            media_type.value: media_payload,
        }
        return await self._send_with_retry(payload)

    async def send_location(
        self, to: str, latitude: float, longitude: float, name: str = "", address: str = ""
    ) -> SendResult:
        """Envía ubicación."""
        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "location",
            "location": {
                "latitude": latitude,
                "longitude": longitude,
                "name": name,
                "address": address,
            },
        }
        return await self._send_with_retry(payload)

    async def verify_credentials(self) -> bool:
        """Verifica que las credenciales son válidas."""
        try:
            response = await self._client.get("/")
            return response.status_code == 200
        except httpx.HTTPError:
            return False

    async def _send_with_retry(self, payload: dict) -> SendResult:
        """Envía con backoff exponencial (1s, 2s, 4s) para rate-limiting.

        Args:
            payload: Cuerpo del mensaje a enviar.

        Returns:
            SendResult con éxito/error y conteo de reintentos.
        """
        last_error = ""
        for attempt in range(self.MAX_RETRIES + 1):
            try:
                response = await self._client.post("/messages", json=payload)

                if response.status_code == 200 or response.status_code == 201:
                    data = response.json()
                    msg_id = data.get("messages", [{}])[0].get("id")
                    return SendResult(
                        success=True, message_id=msg_id, retries=attempt
                    )

                if response.status_code == 429:
                    # Rate limited — retry con backoff
                    if attempt < self.MAX_RETRIES:
                        await asyncio.sleep(self.BACKOFF_SECONDS[attempt])
                        continue
                    last_error = "Rate limit exceeded after retries"
                else:
                    last_error = f"HTTP {response.status_code}: {response.text}"
                    break  # No retry en errores que no son rate limit

            except httpx.HTTPError as e:
                last_error = str(e)
                if attempt < self.MAX_RETRIES:
                    await asyncio.sleep(self.BACKOFF_SECONDS[attempt])
                    continue

        return SendResult(success=False, error=last_error, retries=attempt)

    async def close(self):
        """Cierra el cliente HTTP."""
        await self._client.aclose()

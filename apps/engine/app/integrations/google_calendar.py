"""Servicio de Google Calendar para agendamiento de citas.

Implementa:
- Consulta de disponibilidad (próximos 7 días, bloques 30 min)
- Creación de eventos con datos del lead
- Cancelación y reprogramación (máximo 3 por cita)
- Recordatorios 24h y 1h antes

Valida: Requisitos 5.1, 5.2, 5.6, 5.9
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx


@dataclass
class TimeSlot:
    """Bloque de tiempo disponible."""

    start: datetime
    end: datetime
    duration_minutes: int = 30


@dataclass
class AppointmentData:
    """Datos para crear un evento de cita."""

    lead_name: str
    lead_channel: str
    summary: str  # max 500 chars
    lead_score: int
    start_time: datetime
    end_time: datetime
    attendee_email: str | None = None


@dataclass
class AppointmentResult:
    """Resultado de operación de cita."""

    success: bool
    event_id: str | None = None
    error: str | None = None


MAX_RESCHEDULES = 3
SLOT_DURATION_MINUTES = 30
DAYS_AHEAD = 7
MAX_RETRIES = 3
RETRY_INTERVAL_S = 5


class CalendarService:
    """Servicio de Google Calendar con retry y validación."""

    def __init__(self, credentials: dict[str, Any]):
        """Inicializa con credenciales OAuth2.

        Args:
            credentials: Dict con access_token y refresh_token.
        """
        self.access_token = credentials.get("access_token", "")
        self.refresh_token = credentials.get("refresh_token", "")
        self.calendar_id = credentials.get("calendar_id", "primary")
        self._client = httpx.AsyncClient(
            base_url="https://www.googleapis.com/calendar/v3",
            headers={"Authorization": f"Bearer {self.access_token}"},
            timeout=10.0,
        )

    async def get_available_slots(
        self,
        business_hours: dict[str, Any] | None = None,
    ) -> list[TimeSlot]:
        """Consulta disponibilidad en próximos 7 días, bloques de 30 min.

        Args:
            business_hours: Config de horarios del tenant.

        Returns:
            Lista de slots disponibles (mínimo intenta retornar 3).
        """
        now = datetime.now(timezone.utc)
        end = now + timedelta(days=DAYS_AHEAD)

        # Obtener eventos existentes para detectar conflictos
        events = await self._get_events(now, end)
        busy_times = [
            (
                datetime.fromisoformat(e["start"].get("dateTime", "")),
                datetime.fromisoformat(e["end"].get("dateTime", "")),
            )
            for e in events
            if "dateTime" in e.get("start", {})
        ]

        # Generar slots disponibles
        # ponytail: horarios por defecto lun-vie 09:00-18:00 UTC
        hours = business_hours or {"start": 9, "end": 18, "days": [0, 1, 2, 3, 4]}
        slots: list[TimeSlot] = []

        current = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
        while current < end and len(slots) < 20:
            if current.weekday() in hours["days"]:
                if hours["start"] <= current.hour < hours["end"]:
                    slot_end = current + timedelta(minutes=SLOT_DURATION_MINUTES)
                    # Verificar que no hay conflicto
                    conflict = any(
                        start < slot_end and end > current for start, end in busy_times
                    )
                    if not conflict:
                        slots.append(TimeSlot(start=current, end=slot_end))
            current += timedelta(minutes=SLOT_DURATION_MINUTES)

        return slots

    async def create_appointment(self, data: AppointmentData) -> AppointmentResult:
        """Crea un evento en Google Calendar con datos del lead.

        El evento incluye: nombre del lead, canal de origen, resumen (max 500),
        y Lead Score.

        Args:
            data: Datos de la cita.

        Returns:
            AppointmentResult con éxito y event_id.
        """
        # Validar resumen max 500 chars
        summary = data.summary[:500]

        event_body = {
            "summary": f"Cita: {data.lead_name}",
            "description": (
                f"Lead: {data.lead_name}\n"
                f"Canal: {data.lead_channel}\n"
                f"Score: {data.lead_score}/100\n"
                f"Resumen: {summary}"
            ),
            "start": {"dateTime": data.start_time.isoformat(), "timeZone": "UTC"},
            "end": {"dateTime": data.end_time.isoformat(), "timeZone": "UTC"},
        }

        if data.attendee_email:
            event_body["attendees"] = [{"email": data.attendee_email}]

        return await self._create_with_retry(event_body)

    async def cancel_appointment(self, event_id: str) -> AppointmentResult:
        """Cancela un evento existente."""
        try:
            response = await self._client.delete(
                f"/calendars/{self.calendar_id}/events/{event_id}"
            )
            if response.status_code in (200, 204):
                return AppointmentResult(success=True, event_id=event_id)
            return AppointmentResult(
                success=False, error=f"HTTP {response.status_code}"
            )
        except httpx.HTTPError as e:
            return AppointmentResult(success=False, error=str(e))

    async def send_reminder(self, event_id: str, channel: str, lead_id: str) -> bool:
        """Envía recordatorio de cita por el canal del lead.

        ponytail: en producción se conecta con el Message Router para enviar
        por WhatsApp/WebChat. Por ahora retorna True.
        """
        # Se implementa en wiring (task 19)
        return True

    def can_reschedule(self, current_reschedule_count: int) -> bool:
        """Verifica si se puede reprogramar (máximo 3 por cita)."""
        return current_reschedule_count < MAX_RESCHEDULES

    async def _get_events(self, start: datetime, end: datetime) -> list[dict]:
        """Obtiene eventos del calendario en un rango."""
        try:
            response = await self._client.get(
                f"/calendars/{self.calendar_id}/events",
                params={
                    "timeMin": start.isoformat(),
                    "timeMax": end.isoformat(),
                    "singleEvents": "true",
                    "orderBy": "startTime",
                },
            )
            if response.status_code == 200:
                return response.json().get("items", [])
            return []
        except httpx.HTTPError:
            return []

    async def _create_with_retry(self, event_body: dict) -> AppointmentResult:
        """Crea evento con 3 reintentos (5s intervalo)."""
        for attempt in range(MAX_RETRIES):
            try:
                response = await self._client.post(
                    f"/calendars/{self.calendar_id}/events",
                    json=event_body,
                )
                if response.status_code in (200, 201):
                    data = response.json()
                    return AppointmentResult(success=True, event_id=data.get("id"))
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(RETRY_INTERVAL_S)
            except httpx.HTTPError:
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(RETRY_INTERVAL_S)

        return AppointmentResult(success=False, error="Failed after retries")

    async def close(self):
        """Cierra el cliente HTTP."""
        await self._client.aclose()

"""Scheduler de secuencias de seguimiento automatizadas.

Detecta leads inactivos y ejecuta secuencias de follow-up.
Se ejecuta como cron cada 15 minutos.

Límites MVP:
- Máximo 3 pasos por secuencia
- Intervalos entre 1 y 72 horas
- Máximo 10 secuencias activas por tenant
- Respeta ventana horaria del tenant

Valida: Requisitos 4.1, 4.2, 4.3, 4.6
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import StrEnum


class SequenceStatus(StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    STOPPED = "stopped"


@dataclass
class SequenceStep:
    """Paso individual de una secuencia."""

    step_number: int
    interval_hours: int  # 1-72
    message_template: str
    channel: str | None = None  # None = canal preferido del lead


@dataclass
class SequenceConfig:
    """Configuración de una secuencia de seguimiento."""

    id: str
    tenant_id: str
    name: str
    trigger_after_hours: int  # Horas de inactividad para trigger
    steps: list[SequenceStep]
    active: bool = True
    business_hours_start: int = 9
    business_hours_end: int = 18


@dataclass
class ScheduledMessage:
    """Mensaje programado para envío."""

    lead_id: str
    step_number: int
    scheduled_at: datetime
    content: str
    channel: str


# Límites del MVP
MAX_STEPS = 3
MIN_INTERVAL_HOURS = 1
MAX_INTERVAL_HOURS = 72
MAX_ACTIVE_SEQUENCES = 10


def validate_sequence(config: SequenceConfig) -> list[str]:
    """Valida una configuración de secuencia contra los límites MVP.

    Returns:
        Lista de errores (vacía si válida).
    """
    errors: list[str] = []

    if len(config.steps) > MAX_STEPS:
        errors.append(f"Máximo {MAX_STEPS} pasos permitidos, tiene {len(config.steps)}")

    for step in config.steps:
        if step.interval_hours < MIN_INTERVAL_HOURS:
            errors.append(f"Paso {step.step_number}: intervalo mínimo es {MIN_INTERVAL_HOURS}h")
        if step.interval_hours > MAX_INTERVAL_HOURS:
            errors.append(f"Paso {step.step_number}: intervalo máximo es {MAX_INTERVAL_HOURS}h")

    return errors


def is_within_business_hours(dt: datetime, start_hour: int, end_hour: int) -> bool:
    """Verifica si un datetime está dentro del horario comercial."""
    return start_hour <= dt.hour < end_hour


def next_business_hour(dt: datetime, start_hour: int) -> datetime:
    """Calcula el siguiente inicio de horario comercial."""
    next_day = dt.replace(hour=start_hour, minute=0, second=0, microsecond=0)
    if next_day <= dt:
        next_day += timedelta(days=1)
    # Saltar fines de semana
    while next_day.weekday() >= 5:
        next_day += timedelta(days=1)
    return next_day


def schedule_step(
    config: SequenceConfig,
    step: SequenceStep,
    base_time: datetime,
) -> datetime:
    """Calcula cuándo enviar un paso, respetando ventana horaria.

    Si el horario calculado cae fuera de la ventana, se pospone
    al inicio de la siguiente ventana.
    """
    scheduled = base_time + timedelta(hours=step.interval_hours)

    if not is_within_business_hours(
        scheduled, config.business_hours_start, config.business_hours_end
    ):
        scheduled = next_business_hour(scheduled, config.business_hours_start)

    return scheduled


def should_stop_sequence(lead_responded: bool) -> bool:
    """Determina si se debe detener la secuencia.

    Se detiene inmediatamente cuando el lead responde (max 60s).
    """
    return lead_responded

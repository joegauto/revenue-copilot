/**
 * Cola de Mensajes por Canal — Encolamiento con límites de capacidad y TTL.
 *
 * Validates: Requirements 1.6, 1.9
 *
 * - Máximo 500 mensajes por canal.
 * - Retención máxima de 72 horas.
 * - Al restablecerse el canal, reenviar en orden cronológico.
 * - Descartar mensajes más antiguos al alcanzar límites + registrar alerta.
 *
 * Implementación en memoria (Map) con la misma interfaz que usaría Redis
 * (sorted sets por timestamp). Preparado para migrar a Redis cuando se configure.
 */

const MAX_MESSAGES_PER_CHANNEL = 500;
const MAX_RETENTION_MS = 72 * 60 * 60 * 1000; // 72 horas

export interface QueuedMessage {
  id: string;
  tenantId: string;
  channel: string;
  recipientId: string;
  content: string;
  metadata: Record<string, unknown>;
  enqueuedAt: Date;
}

export interface EnqueueResult {
  success: boolean;
  discarded?: number;
}

// Store en memoria — en producción se reemplaza por Redis sorted sets
// Key: channel name (e.g., "whatsapp", "webchat")
const queueStore = new Map<string, QueuedMessage[]>();

// Alertas registradas (en producción se enviarían a un sistema de logging)
const alerts: Array<{ type: string; channel: string; message: string; timestamp: Date }> = [];

/**
 * Registra una alerta de pérdida de mensajes o expiración.
 */
function logAlert(type: string, channel: string, message: string, now: Date = new Date()): void {
  alerts.push({ type, channel, message, timestamp: now });
}

/**
 * Encola un mensaje en el canal especificado.
 *
 * - Si la cola alcanza 500 mensajes, descarta los más antiguos para hacer espacio.
 * - Registra alerta cuando se descartan mensajes por límite de capacidad.
 *
 * @param channel - Canal de destino (e.g., "whatsapp", "webchat")
 * @param message - Mensaje a encolar
 * @returns Resultado con success y cantidad de mensajes descartados
 */
export async function enqueue(
  channel: string,
  message: QueuedMessage
): Promise<EnqueueResult> {
  let queue = queueStore.get(channel) || [];
  let discarded = 0;

  // Primero purgar mensajes expirados antes de evaluar capacidad
  const now = message.enqueuedAt.getTime();
  const beforePurge = queue.length;
  queue = queue.filter((msg) => now - msg.enqueuedAt.getTime() < MAX_RETENTION_MS);
  const expiredCount = beforePurge - queue.length;

  if (expiredCount > 0) {
    logAlert(
      "message_expired",
      channel,
      `${expiredCount} mensaje(s) descartado(s) por superar 72h de retención`,
      new Date(now)
    );
  }

  // Si la cola está llena (500), descartar los más antiguos para hacer espacio
  if (queue.length >= MAX_MESSAGES_PER_CHANNEL) {
    discarded = queue.length - MAX_MESSAGES_PER_CHANNEL + 1;
    queue = queue.slice(discarded);
    logAlert(
      "capacity_exceeded",
      channel,
      `${discarded} mensaje(s) descartado(s) por alcanzar capacidad máxima de ${MAX_MESSAGES_PER_CHANNEL}`,
      new Date(now)
    );
  }

  // Insertar el nuevo mensaje manteniendo orden cronológico
  queue.push(message);
  // Ordenar por enqueuedAt para garantizar orden cronológico
  queue.sort((a, b) => a.enqueuedAt.getTime() - b.enqueuedAt.getTime());

  queueStore.set(channel, queue);

  return {
    success: true,
    discarded: discarded > 0 ? discarded : undefined,
  };
}

/**
 * Extrae todos los mensajes de la cola de un canal en orden cronológico.
 * Limpia la cola después de extraer.
 *
 * Se usa cuando el canal se restablece para reenviar mensajes pendientes.
 *
 * @param channel - Canal del cual extraer mensajes
 * @returns Array de mensajes en orden cronológico (más antiguo primero)
 */
export async function dequeueAll(channel: string): Promise<QueuedMessage[]> {
  const queue = queueStore.get(channel) || [];

  // Purgar expirados antes de devolver
  const now = Date.now();
  const validMessages = queue.filter(
    (msg) => now - msg.enqueuedAt.getTime() < MAX_RETENTION_MS
  );

  const expiredCount = queue.length - validMessages.length;
  if (expiredCount > 0) {
    logAlert(
      "message_expired",
      channel,
      `${expiredCount} mensaje(s) descartado(s) por superar 72h de retención al dequeue`,
      new Date(now)
    );
  }

  // Limpiar la cola
  queueStore.delete(channel);

  // Retornar en orden cronológico (ya están ordenados)
  return validMessages.sort((a, b) => a.enqueuedAt.getTime() - b.enqueuedAt.getTime());
}

/**
 * Retorna el tamaño actual de la cola de un canal.
 *
 * @param channel - Canal a consultar
 * @returns Número de mensajes en la cola
 */
export async function getQueueSize(channel: string): Promise<number> {
  const queue = queueStore.get(channel) || [];
  return queue.length;
}

/**
 * Purga mensajes expirados (más de 72 horas) de la cola de un canal.
 *
 * @param channel - Canal a purgar
 * @param now - Timestamp actual en ms (inyectable para testing)
 * @returns Número de mensajes eliminados
 */
export async function purgeExpired(
  channel: string,
  now: number = Date.now()
): Promise<number> {
  const queue = queueStore.get(channel) || [];

  if (queue.length === 0) return 0;

  const validMessages = queue.filter(
    (msg) => now - msg.enqueuedAt.getTime() < MAX_RETENTION_MS
  );

  const removedCount = queue.length - validMessages.length;

  if (removedCount > 0) {
    logAlert(
      "message_expired",
      channel,
      `${removedCount} mensaje(s) descartado(s) por superar 72h de retención`,
      new Date(now)
    );
    queueStore.set(channel, validMessages);
  }

  return removedCount;
}

// Exportar constantes para tests
export const QUEUE_CONFIG = {
  MAX_MESSAGES_PER_CHANNEL,
  MAX_RETENTION_MS,
} as const;

// Exportar para testing — permite limpiar el store entre tests
export function _clearStore(): void {
  queueStore.clear();
  alerts.length = 0;
}

// Exportar alertas para testing
export function _getAlerts(): Array<{ type: string; channel: string; message: string; timestamp: Date }> {
  return [...alerts];
}

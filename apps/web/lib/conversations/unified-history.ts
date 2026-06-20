/**
 * Historial Unificado de Conversaciones
 *
 * Almacena todos los mensajes con marca de tiempo, canal y contenido.
 * Unifica historial independientemente del canal utilizado.
 * Carga últimos 20 mensajes como contexto para el agente.
 *
 * Requisitos: 1.4, 3.1
 */

export interface HistoryMessage {
  id: string;
  leadId: string;
  conversationId: string;
  channel: string;
  direction: "inbound" | "outbound";
  content: string;
  messageType: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface UnifiedHistory {
  leadId: string;
  messages: HistoryMessage[];
  channels: string[];
  lastActivity: Date | null;
}

const CONTEXT_WINDOW = 20;

// ponytail: store en memoria. Upgrade: Redis sorted sets por leadId.
const historyStore = new Map<string, HistoryMessage[]>();

/**
 * Agrega un mensaje al historial unificado del lead.
 */
export function addMessage(message: HistoryMessage): void {
  const existing = historyStore.get(message.leadId) || [];
  existing.push(message);
  // Mantener orden cronológico
  existing.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  historyStore.set(message.leadId, existing);
}

/**
 * Obtiene el historial unificado de un lead (todos los canales, orden cronológico).
 */
export function getHistory(leadId: string): UnifiedHistory {
  const messages = historyStore.get(leadId) || [];
  const channels = [...new Set(messages.map((m) => m.channel))];
  const lastActivity =
    messages.length > 0 ? messages[messages.length - 1].timestamp : null;

  return {
    leadId,
    messages,
    channels,
    lastActivity,
  };
}

/**
 * Obtiene los últimos N mensajes como contexto para el agente.
 * Retorna en formato [{role, content}] para LangChain.
 */
export function getContextWindow(
  leadId: string,
  limit: number = CONTEXT_WINDOW
): Array<{ role: string; content: string }> {
  const messages = historyStore.get(leadId) || [];
  const recent = messages.slice(-limit);

  return recent.map((msg) => ({
    role: msg.direction === "inbound" ? "user" : "assistant",
    content: msg.content,
  }));
}

/**
 * Verifica si el lead tuvo actividad en las últimas N horas.
 */
export function hadActivityWithin(leadId: string, hours: number): boolean {
  const messages = historyStore.get(leadId) || [];
  if (messages.length === 0) return false;

  const lastMsg = messages[messages.length - 1];
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return lastMsg.timestamp.getTime() > cutoff;
}

// Testing helpers
export function _clearStore(): void {
  historyStore.clear();
}

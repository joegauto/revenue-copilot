/**
 * Message Router — Enrutador unificado de mensajes multi-canal.
 *
 * Recibe mensajes normalizados de cualquier canal:
 * 1. Identifica/crea lead
 * 2. Carga historial
 * 3. Envía al engine
 * 4. Envía respuesta por el canal correspondiente
 * 5. Envía acuse de recibo si respuesta excede SLA
 *
 * Requisitos: 1.1, 1.2, 1.8
 */

export interface IncomingMessage {
  tenantId: string;
  channel: "whatsapp" | "webchat" | "email";
  senderId: string; // phone, email, o sessionId
  content: string;
  messageType: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface OutgoingMessage {
  tenantId: string;
  channel: string;
  recipientId: string;
  content: string;
  messageType: string;
  metadata?: Record<string, unknown>;
}

export interface RouteResult {
  success: boolean;
  leadId: string;
  response: string;
  intent: string;
  score?: number;
  channel: string;
  latencyMs: number;
  ackSent: boolean;
}

// SLA por canal en ms
const CHANNEL_SLA: Record<string, number> = {
  webchat: 3000,
  whatsapp: 10000,
  email: 30000,
};

/**
 * Procesa un mensaje entrante a través del pipeline completo.
 *
 * ponytail: implementación esqueleto que se conecta en task 19 (wiring)
 * con los servicios reales (identity resolver, history, engine client).
 */
export async function routeMessage(message: IncomingMessage): Promise<RouteResult> {
  const start = Date.now();
  const sla = CHANNEL_SLA[message.channel] || 10000;

  // 1. Resolver identidad del lead
  // ponytail: se conecta con resolveLeadIdentity en wiring
  const leadId = `lead-${message.senderId}`;

  // 2. Agregar mensaje al historial unificado
  // ponytail: se conecta con addMessage(unified-history) en wiring

  // 3. Enviar al engine para procesamiento
  // ponytail: se conecta con fetch al engine /process-message en wiring
  const response = "Gracias por tu mensaje.";
  const intent = "otro";

  const latencyMs = Date.now() - start;
  const ackSent = latencyMs > sla;

  // 4. Si excede SLA, enviar acuse de recibo primero
  // ponytail: se implementa el envío del ack en wiring

  return {
    success: true,
    leadId,
    response,
    intent,
    channel: message.channel,
    latencyMs,
    ackSent,
  };
}

/**
 * Determina el canal de respuesta para un lead.
 * Usa el último canal de interacción del lead.
 */
export function getResponseChannel(
  preferredChannel: string | null,
  lastChannel: string
): string {
  return preferredChannel || lastChannel;
}

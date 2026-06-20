/**
 * WebSocket server con Socket.IO para web chat en tiempo real.
 *
 * Asocia cada conexión a un tenant + session ID.
 * Normaliza mensajes de web chat al formato IncomingMessage.
 * Respeta SLA de 3 segundos para respuesta en web chat.
 *
 * Requisito: 1.2
 *
 * ponytail: Next.js App Router no soporta WebSocket nativo.
 * En producción se usa un servidor Socket.IO separado o Pages Router.
 * Este archivo define la interfaz/contrato del socket server.
 */

import { NextResponse } from "next/server";

/**
 * Socket.IO events contract:
 *
 * Client → Server:
 *   "chat:message" { tenantId, sessionId, content, messageType }
 *   "chat:typing"  { tenantId, sessionId }
 *
 * Server → Client:
 *   "chat:response" { content, intent, metadata }
 *   "chat:typing"   { active: boolean }
 *   "chat:error"    { message, code }
 *   "chat:ack"      { messageId, status }
 */

export interface SocketMessage {
  tenantId: string;
  sessionId: string;
  content: string;
  messageType?: string;
}

export interface SocketResponse {
  content: string;
  intent: string;
  metadata?: Record<string, unknown>;
}

// Placeholder endpoint — el socket server real corre como proceso aparte
export async function GET() {
  return NextResponse.json({
    info: "Socket.IO server runs on a separate process. See docker-compose.yml.",
    events: {
      clientToServer: ["chat:message", "chat:typing"],
      serverToClient: ["chat:response", "chat:typing", "chat:error", "chat:ack"],
    },
  });
}

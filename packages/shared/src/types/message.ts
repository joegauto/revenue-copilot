/**
 * Interfaces de mensajes entrantes y salientes.
 * Validates: Requirements 1.1, 1.2
 */

export interface IncomingMessage {
  tenantId: string;
  channel: 'whatsapp' | 'webchat';
  senderId: string;
  messageType: 'text' | 'image' | 'document' | 'audio' | 'location';
  content: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

export interface OutgoingMessage {
  tenantId: string;
  channel: 'whatsapp' | 'webchat';
  recipientId: string;
  content: string;
  templateId?: string;
  metadata: Record<string, unknown>;
}

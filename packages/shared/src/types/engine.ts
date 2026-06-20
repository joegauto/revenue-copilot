/**
 * Interfaces de procesamiento del engine de IA.
 * Validates: Requirements 1.1, 1.2
 */

export interface ProcessMessageRequest {
  tenantId: string;
  leadId: string;
  channel: 'whatsapp' | 'webchat';
  message: string;
  messageType: string;
  metadata: Record<string, unknown>;
}

export interface ProcessMessageResponse {
  response: string;
  intent: string;
  newScore: number;
  scoreDelta: number;
  action: 'none' | 'escalate' | 'schedule' | 'notify';
  responseTimeMs: number;
}

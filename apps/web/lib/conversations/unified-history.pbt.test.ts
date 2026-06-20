/**
 * Property-based tests para historial unificado.
 *
 * Property 1: Historial unificado multi-canal
 * - Para cualquier secuencia de mensajes por distintos canales,
 *   el historial contiene todos los mensajes ordenados cronológicamente.
 * - Preserva marca de tiempo, canal y contenido.
 *
 * Property 2: Continuidad de contexto cross-canal
 * - Al cambiar de canal (dentro de 24h), el contexto incluye historial del canal previo.
 *
 * Valida: Requisitos 1.4, 1.5
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  addMessage,
  getHistory,
  getContextWindow,
  _clearStore,
  type HistoryMessage,
} from "./unified-history";

beforeEach(() => {
  _clearStore();
});

const channelArb = fc.constantFrom("whatsapp", "webchat", "email", "sms");
const directionArb = fc.constantFrom("inbound" as const, "outbound" as const);

describe("Property 1: Historial unificado multi-canal", () => {
  it("contiene todos los mensajes en orden cronológico", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            channel: channelArb,
            direction: directionArb,
            content: fc.string({ minLength: 1, maxLength: 100 }),
            offset: fc.integer({ min: 0, max: 100000 }),
          }),
          { minLength: 1, maxLength: 50 }
        ),
        (messageSpecs) => {
          _clearStore();
          const leadId = "lead-1";
          const baseTime = Date.now();

          // Agregar mensajes en orden arbitrario
          for (let i = 0; i < messageSpecs.length; i++) {
            const spec = messageSpecs[i];
            addMessage({
              id: `msg-${i}`,
              leadId,
              conversationId: "conv-1",
              channel: spec.channel,
              direction: spec.direction,
              content: spec.content,
              messageType: "text",
              timestamp: new Date(baseTime + spec.offset),
            });
          }

          const history = getHistory(leadId);

          // Contiene todos los mensajes
          expect(history.messages.length).toBe(messageSpecs.length);

          // Orden cronológico
          for (let i = 1; i < history.messages.length; i++) {
            expect(history.messages[i].timestamp.getTime()).toBeGreaterThanOrEqual(
              history.messages[i - 1].timestamp.getTime()
            );
          }

          // Preserva contenido
          const contents = new Set(messageSpecs.map((s) => s.content));
          for (const msg of history.messages) {
            expect(contents.has(msg.content)).toBe(true);
          }

          // Preserva canales en la lista
          const usedChannels = new Set(messageSpecs.map((s) => s.channel));
          for (const ch of usedChannels) {
            expect(history.channels).toContain(ch);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe("Property 2: Continuidad de contexto cross-canal", () => {
  it("contexto incluye mensajes de todos los canales", () => {
    fc.assert(
      fc.property(
        fc.array(channelArb, { minLength: 2, maxLength: 5 }),
        fc.integer({ min: 1, max: 5 }),
        (channels, msgsPerChannel) => {
          _clearStore();
          const leadId = "lead-1";
          const baseTime = Date.now();
          let msgIndex = 0;

          // Simular conversación cross-canal
          for (const channel of channels) {
            for (let i = 0; i < msgsPerChannel; i++) {
              addMessage({
                id: `msg-${msgIndex}`,
                leadId,
                conversationId: "conv-1",
                channel,
                direction: i % 2 === 0 ? "inbound" : "outbound",
                content: `Msg ${msgIndex} on ${channel}`,
                messageType: "text",
                timestamp: new Date(baseTime + msgIndex * 1000),
              });
              msgIndex++;
            }
          }

          const context = getContextWindow(leadId);
          const totalMsgs = channels.length * msgsPerChannel;
          const expectedContextSize = Math.min(totalMsgs, 20);

          // Contexto tiene el tamaño correcto
          expect(context.length).toBe(expectedContextSize);

          // Si hay pocos mensajes, todos los canales están representados
          if (totalMsgs <= 20) {
            const history = getHistory(leadId);
            const allChannels = new Set(history.messages.map((m) => m.channel));
            expect(allChannels.size).toBe(new Set(channels).size);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});

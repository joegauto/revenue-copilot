/**
 * Property-based tests para cola de mensajes.
 *
 * Property 3: Invariantes de cola de mensajes
 * - Cola nunca excede 500 mensajes
 * - Mensajes > 72h se descartan
 * - Orden cronológico al reenviar
 * - Al alcanzar límite se descartan los más antiguos primero
 *
 * Valida: Requisitos 1.6, 1.9
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  enqueue,
  dequeueAll,
  getQueueSize,
  QUEUE_CONFIG,
  _clearStore,
  type QueuedMessage,
} from "./message-queue";

beforeEach(() => {
  _clearStore();
});

describe("Property 3: Invariantes de cola de mensajes", () => {
  it("la cola nunca excede 500 mensajes", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 800 }),
        async (messageCount) => {
          _clearStore();
          const now = Date.now();

          for (let i = 0; i < messageCount; i++) {
            await enqueue("test-channel", {
              id: `msg-${i}`,
              tenantId: "tenant-1",
              channel: "test-channel",
              content: `Mensaje ${i}`,
              metadata: {},
              enqueuedAt: new Date(now + i * 100),
            });
          }

          const size = await getQueueSize("test-channel");
          expect(size).toBeLessThanOrEqual(500);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("mensajes > 72h se descartan al encolar uno nuevo", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 50 }),
        async (expiredCount) => {
          _clearStore();
          const now = Date.now();
          const expired = now - QUEUE_CONFIG.MAX_RETENTION_MS - 1000;

          // Encolar mensajes expirados
          for (let i = 0; i < expiredCount; i++) {
            await enqueue("test-channel", {
              id: `old-${i}`,
              tenantId: "tenant-1",
              channel: "test-channel",
              content: "viejo",
              metadata: {},
              enqueuedAt: new Date(expired + i),
            });
          }

          // Encolar uno nuevo que trigger purge de expirados
          await enqueue("test-channel", {
            id: "new-msg",
            tenantId: "tenant-1",
            channel: "test-channel",
            content: "nuevo",
            metadata: {},
            enqueuedAt: new Date(now),
          });

          const messages = await dequeueAll("test-channel");
          // Solo el mensaje nuevo debería estar
          for (const msg of messages) {
            const age = now - msg.enqueuedAt.getTime();
            expect(age).toBeLessThan(QUEUE_CONFIG.MAX_RETENTION_MS);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("dequeueAll retorna mensajes en orden cronológico", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 0, max: 10000 }), { minLength: 2, maxLength: 100 }),
        async (offsets) => {
          _clearStore();
          const now = Date.now();

          for (let i = 0; i < offsets.length; i++) {
            await enqueue("test-channel", {
              id: `msg-${i}`,
              tenantId: "tenant-1",
              channel: "test-channel",
              content: `msg ${i}`,
              metadata: {},
              enqueuedAt: new Date(now + offsets[i]),
            });
          }

          const messages = await dequeueAll("test-channel");

          // Verificar orden cronológico
          for (let i = 1; i < messages.length; i++) {
            expect(messages[i].enqueuedAt.getTime()).toBeGreaterThanOrEqual(
              messages[i - 1].enqueuedAt.getTime()
            );
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("al alcanzar límite se descartan los más antiguos", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 501, max: 520 }),
        async (totalMessages) => {
          _clearStore();
          const now = Date.now();

          for (let i = 0; i < totalMessages; i++) {
            await enqueue("test-channel", {
              id: `msg-${i}`,
              tenantId: "tenant-1",
              channel: "test-channel",
              content: `msg ${i}`,
              metadata: {},
              enqueuedAt: new Date(now + i * 100),
            });
          }

          const messages = await dequeueAll("test-channel");

          // El mensaje más reciente siempre está presente
          const lastId = `msg-${totalMessages - 1}`;
          expect(messages.some((m) => m.id === lastId)).toBe(true);

          // Los más antiguos fueron descartados
          expect(messages.length).toBeLessThanOrEqual(500);
        }
      ),
      { numRuns: 200 }
    );
  });
});

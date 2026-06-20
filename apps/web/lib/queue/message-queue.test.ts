import { describe, it, expect, beforeEach } from "vitest";
import {
  enqueue,
  dequeueAll,
  getQueueSize,
  purgeExpired,
  QUEUE_CONFIG,
  _clearStore,
  _getAlerts,
  type QueuedMessage,
} from "./message-queue";

function createMessage(
  overrides: Partial<QueuedMessage> = {}
): QueuedMessage {
  return {
    id: overrides.id ?? `msg-${Math.random().toString(36).slice(2)}`,
    tenantId: overrides.tenantId ?? "tenant-1",
    channel: overrides.channel ?? "whatsapp",
    recipientId: overrides.recipientId ?? "recipient-1",
    content: overrides.content ?? "Hola, ¿cómo estás?",
    metadata: overrides.metadata ?? {},
    enqueuedAt: overrides.enqueuedAt ?? new Date(),
  };
}

describe("MessageQueue", () => {
  beforeEach(() => {
    _clearStore();
  });

  describe("enqueue", () => {
    it("encola un mensaje exitosamente", async () => {
      const msg = createMessage({ channel: "whatsapp" });
      const result = await enqueue("whatsapp", msg);

      expect(result.success).toBe(true);
      expect(result.discarded).toBeUndefined();
      expect(await getQueueSize("whatsapp")).toBe(1);
    });

    it("encola múltiples mensajes en el mismo canal", async () => {
      const now = Date.now();
      for (let i = 0; i < 10; i++) {
        const msg = createMessage({
          id: `msg-${i}`,
          channel: "whatsapp",
          enqueuedAt: new Date(now + i * 1000),
        });
        await enqueue("whatsapp", msg);
      }

      expect(await getQueueSize("whatsapp")).toBe(10);
    });

    it("mantiene colas independientes por canal", async () => {
      await enqueue("whatsapp", createMessage({ channel: "whatsapp" }));
      await enqueue("whatsapp", createMessage({ channel: "whatsapp" }));
      await enqueue("webchat", createMessage({ channel: "webchat" }));

      expect(await getQueueSize("whatsapp")).toBe(2);
      expect(await getQueueSize("webchat")).toBe(1);
    });

    it("descarta mensajes antiguos al alcanzar 500", async () => {
      const now = Date.now();

      // Llenar la cola con 500 mensajes
      for (let i = 0; i < 500; i++) {
        const msg = createMessage({
          id: `msg-${i}`,
          channel: "whatsapp",
          enqueuedAt: new Date(now + i * 100),
        });
        await enqueue("whatsapp", msg);
      }

      expect(await getQueueSize("whatsapp")).toBe(500);

      // Encolar el mensaje 501 — debe descartar el más antiguo
      const newMsg = createMessage({
        id: "msg-501",
        channel: "whatsapp",
        enqueuedAt: new Date(now + 500 * 100),
      });
      const result = await enqueue("whatsapp", newMsg);

      expect(result.success).toBe(true);
      expect(result.discarded).toBe(1);
      expect(await getQueueSize("whatsapp")).toBe(500);
    });

    it("registra alerta al descartar por capacidad", async () => {
      const now = Date.now();

      for (let i = 0; i < 500; i++) {
        await enqueue(
          "whatsapp",
          createMessage({
            id: `msg-${i}`,
            channel: "whatsapp",
            enqueuedAt: new Date(now + i * 100),
          })
        );
      }

      await enqueue(
        "whatsapp",
        createMessage({
          id: "msg-overflow",
          channel: "whatsapp",
          enqueuedAt: new Date(now + 500 * 100),
        })
      );

      const alerts = _getAlerts();
      const capacityAlerts = alerts.filter((a) => a.type === "capacity_exceeded");
      expect(capacityAlerts.length).toBeGreaterThan(0);
      expect(capacityAlerts[0].channel).toBe("whatsapp");
    });

    it("descarta mensajes expirados al encolar", async () => {
      const now = Date.now();
      const expiredTime = now - QUEUE_CONFIG.MAX_RETENTION_MS - 1000; // 72h + 1s atrás

      // Encolar un mensaje expirado
      await enqueue(
        "whatsapp",
        createMessage({
          id: "msg-old",
          channel: "whatsapp",
          enqueuedAt: new Date(expiredTime),
        })
      );

      expect(await getQueueSize("whatsapp")).toBe(1);

      // Encolar un mensaje nuevo — el expirado debe ser purgado
      const newMsg = createMessage({
        id: "msg-new",
        channel: "whatsapp",
        enqueuedAt: new Date(now),
      });
      await enqueue("whatsapp", newMsg);

      expect(await getQueueSize("whatsapp")).toBe(1);

      const alerts = _getAlerts();
      const expiredAlerts = alerts.filter((a) => a.type === "message_expired");
      expect(expiredAlerts.length).toBeGreaterThan(0);
    });

    it("mantiene orden cronológico al encolar", async () => {
      const now = Date.now();

      // Encolar en orden inverso
      await enqueue(
        "whatsapp",
        createMessage({ id: "msg-3", enqueuedAt: new Date(now + 3000) })
      );
      await enqueue(
        "whatsapp",
        createMessage({ id: "msg-1", enqueuedAt: new Date(now + 1000) })
      );
      await enqueue(
        "whatsapp",
        createMessage({ id: "msg-2", enqueuedAt: new Date(now + 2000) })
      );

      const messages = await dequeueAll("whatsapp");
      expect(messages[0].id).toBe("msg-1");
      expect(messages[1].id).toBe("msg-2");
      expect(messages[2].id).toBe("msg-3");
    });
  });

  describe("dequeueAll", () => {
    it("retorna array vacío para canal sin mensajes", async () => {
      const messages = await dequeueAll("whatsapp");
      expect(messages).toEqual([]);
    });

    it("retorna todos los mensajes en orden cronológico", async () => {
      const now = Date.now();

      for (let i = 0; i < 5; i++) {
        await enqueue(
          "whatsapp",
          createMessage({
            id: `msg-${i}`,
            enqueuedAt: new Date(now + i * 1000),
          })
        );
      }

      const messages = await dequeueAll("whatsapp");
      expect(messages).toHaveLength(5);

      // Verificar orden cronológico
      for (let i = 1; i < messages.length; i++) {
        expect(messages[i].enqueuedAt.getTime()).toBeGreaterThanOrEqual(
          messages[i - 1].enqueuedAt.getTime()
        );
      }
    });

    it("limpia la cola después de extraer", async () => {
      await enqueue("whatsapp", createMessage());
      await enqueue("whatsapp", createMessage());

      expect(await getQueueSize("whatsapp")).toBe(2);

      await dequeueAll("whatsapp");

      expect(await getQueueSize("whatsapp")).toBe(0);
    });

    it("filtra mensajes expirados al extraer", async () => {
      const now = Date.now();
      const expiredTime = now - QUEUE_CONFIG.MAX_RETENTION_MS - 1000;

      // Encolar un mensaje expirado directamente (simulando paso del tiempo)
      await enqueue(
        "whatsapp",
        createMessage({
          id: "msg-expired",
          enqueuedAt: new Date(expiredTime),
        })
      );
      await enqueue(
        "whatsapp",
        createMessage({
          id: "msg-valid",
          enqueuedAt: new Date(now),
        })
      );

      // Al hacer dequeue, solo debe retornar el válido
      const messages = await dequeueAll("whatsapp");
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe("msg-valid");
    });

    it("no afecta otros canales", async () => {
      await enqueue("whatsapp", createMessage({ channel: "whatsapp" }));
      await enqueue("webchat", createMessage({ channel: "webchat" }));

      await dequeueAll("whatsapp");

      expect(await getQueueSize("whatsapp")).toBe(0);
      expect(await getQueueSize("webchat")).toBe(1);
    });
  });

  describe("getQueueSize", () => {
    it("retorna 0 para canal vacío", async () => {
      expect(await getQueueSize("whatsapp")).toBe(0);
    });

    it("retorna el tamaño correcto", async () => {
      await enqueue("whatsapp", createMessage());
      await enqueue("whatsapp", createMessage());
      await enqueue("whatsapp", createMessage());

      expect(await getQueueSize("whatsapp")).toBe(3);
    });
  });

  describe("purgeExpired", () => {
    it("retorna 0 para canal vacío", async () => {
      const removed = await purgeExpired("whatsapp");
      expect(removed).toBe(0);
    });

    it("retorna 0 cuando no hay mensajes expirados", async () => {
      const now = Date.now();
      await enqueue(
        "whatsapp",
        createMessage({ enqueuedAt: new Date(now) })
      );

      const removed = await purgeExpired("whatsapp", now);
      expect(removed).toBe(0);
    });

    it("elimina mensajes con más de 72 horas", async () => {
      const now = Date.now();

      // Encolar dos mensajes con timestamps cercanos
      await enqueue(
        "whatsapp",
        createMessage({ id: "msg-1", enqueuedAt: new Date(now) })
      );
      await enqueue(
        "whatsapp",
        createMessage({ id: "msg-2", enqueuedAt: new Date(now + 1000) })
      );

      expect(await getQueueSize("whatsapp")).toBe(2);

      // Avanzar más de 72h — ambos deberían expirar
      const futureNow = now + QUEUE_CONFIG.MAX_RETENTION_MS + 2000;
      const removed = await purgeExpired("whatsapp", futureNow);

      expect(removed).toBe(2);
      expect(await getQueueSize("whatsapp")).toBe(0);
    });

    it("registra alerta al purgar mensajes expirados", async () => {
      const now = Date.now();

      await enqueue(
        "whatsapp",
        createMessage({ enqueuedAt: new Date(now) })
      );

      // Avanzar más de 72h
      const futureNow = now + QUEUE_CONFIG.MAX_RETENTION_MS + 1000;
      await purgeExpired("whatsapp", futureNow);

      const alerts = _getAlerts();
      const expiredAlerts = alerts.filter((a) => a.type === "message_expired");
      expect(expiredAlerts.length).toBeGreaterThan(0);
    });

    it("mantiene mensajes dentro del TTL", async () => {
      const now = Date.now();

      await enqueue(
        "whatsapp",
        createMessage({ id: "msg-recent", enqueuedAt: new Date(now - 1000) })
      );

      const removed = await purgeExpired("whatsapp", now);
      expect(removed).toBe(0);
      expect(await getQueueSize("whatsapp")).toBe(1);
    });
  });

  describe("Configuración", () => {
    it("tiene el límite correcto de 500 mensajes por canal", () => {
      expect(QUEUE_CONFIG.MAX_MESSAGES_PER_CHANNEL).toBe(500);
    });

    it("tiene la retención correcta de 72 horas", () => {
      expect(QUEUE_CONFIG.MAX_RETENTION_MS).toBe(72 * 60 * 60 * 1000);
    });
  });

  describe("Flujo completo de cola de mensajes", () => {
    it("encola, restablece canal y reenvía en orden cronológico", async () => {
      const now = Date.now();

      // Simular interrupción: encolar 5 mensajes
      for (let i = 0; i < 5; i++) {
        await enqueue(
          "whatsapp",
          createMessage({
            id: `msg-${i}`,
            content: `Mensaje ${i}`,
            enqueuedAt: new Date(now + i * 1000),
          })
        );
      }

      expect(await getQueueSize("whatsapp")).toBe(5);

      // Canal se restablece: extraer todos en orden
      const messages = await dequeueAll("whatsapp");
      expect(messages).toHaveLength(5);

      // Verificar orden cronológico
      for (let i = 0; i < messages.length; i++) {
        expect(messages[i].id).toBe(`msg-${i}`);
        expect(messages[i].content).toBe(`Mensaje ${i}`);
      }

      // Cola vacía después del dequeue
      expect(await getQueueSize("whatsapp")).toBe(0);
    });

    it("maneja overflow con descarte de antiguos y reenvío de recientes", async () => {
      const now = Date.now();

      // Llenar cola con 500 mensajes
      for (let i = 0; i < 500; i++) {
        await enqueue(
          "whatsapp",
          createMessage({
            id: `msg-${i}`,
            enqueuedAt: new Date(now + i * 100),
          })
        );
      }

      // Encolar 5 más — los 5 más antiguos se descartan
      for (let i = 500; i < 505; i++) {
        await enqueue(
          "whatsapp",
          createMessage({
            id: `msg-${i}`,
            enqueuedAt: new Date(now + i * 100),
          })
        );
      }

      expect(await getQueueSize("whatsapp")).toBe(500);

      // Verificar que los más antiguos fueron descartados
      const messages = await dequeueAll("whatsapp");
      expect(messages[0].id).toBe("msg-5");
      expect(messages[messages.length - 1].id).toBe("msg-504");
    });
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  RATE_LIMIT_CONFIG,
  _clearStore,
} from "./rate-limit";

describe("Rate Limit Service", () => {
  beforeEach(() => {
    _clearStore();
  });

  describe("checkRateLimit", () => {
    it("permite la primera solicitud de un tenant", async () => {
      const result = await checkRateLimit("tenant-1");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
      expect(result.resetInSeconds).toBe(60);
    });

    it("permite hasta 100 solicitudes por minuto", async () => {
      const now = Date.now();
      for (let i = 0; i < 100; i++) {
        const result = await checkRateLimit("tenant-1", now);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(99 - i);
      }
    });

    it("rechaza la solicitud 101 dentro del mismo minuto", async () => {
      const now = Date.now();
      // Consumir las 100 solicitudes
      for (let i = 0; i < 100; i++) {
        await checkRateLimit("tenant-1", now);
      }

      // La 101 debe ser rechazada
      const result = await checkRateLimit("tenant-1", now);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.resetInSeconds).toBeGreaterThan(0);
    });

    it("restaura el acceso al inicio del siguiente minuto", async () => {
      const now = Date.now();
      // Consumir las 100 solicitudes
      for (let i = 0; i < 100; i++) {
        await checkRateLimit("tenant-1", now);
      }

      // Verificar que está bloqueado
      const blocked = await checkRateLimit("tenant-1", now);
      expect(blocked.allowed).toBe(false);

      // Avanzar 60 segundos (nueva ventana)
      const nextMinute = now + RATE_LIMIT_CONFIG.WINDOW_DURATION_MS;
      const result = await checkRateLimit("tenant-1", nextMinute);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
    });

    it("maneja tenants diferentes de forma independiente", async () => {
      const now = Date.now();
      // Consumir todas las solicitudes de tenant-1
      for (let i = 0; i < 100; i++) {
        await checkRateLimit("tenant-1", now);
      }

      // tenant-2 no debe estar afectado
      const result = await checkRateLimit("tenant-2", now);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99);
    });

    it("calcula correctamente resetInSeconds a mitad de ventana", async () => {
      const now = Date.now();
      // Primera solicitud inicia la ventana
      await checkRateLimit("tenant-1", now);

      // 30 segundos después
      const halfWay = now + 30_000;
      const result = await checkRateLimit("tenant-1", halfWay);
      expect(result.allowed).toBe(true);
      expect(result.resetInSeconds).toBe(30);
    });

    it("rechaza múltiples solicitudes después del límite", async () => {
      const now = Date.now();
      for (let i = 0; i < 100; i++) {
        await checkRateLimit("tenant-1", now);
      }

      // Varias solicitudes más deben ser rechazadas
      for (let i = 0; i < 5; i++) {
        const result = await checkRateLimit("tenant-1", now);
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
      }
    });

    it("reinicia la ventana correctamente después de expirar", async () => {
      const now = Date.now();
      // Usar 50 solicitudes
      for (let i = 0; i < 50; i++) {
        await checkRateLimit("tenant-1", now);
      }

      // Avanzar 61 segundos (ventana expirada)
      const afterExpiry = now + 61_000;
      const result = await checkRateLimit("tenant-1", afterExpiry);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(99); // Reinicia a 100 - 1
    });

    it("retorna remaining correcto en cada solicitud", async () => {
      const now = Date.now();
      const r1 = await checkRateLimit("tenant-1", now);
      expect(r1.remaining).toBe(99);

      const r2 = await checkRateLimit("tenant-1", now);
      expect(r2.remaining).toBe(98);

      const r3 = await checkRateLimit("tenant-1", now);
      expect(r3.remaining).toBe(97);
    });
  });

  describe("Configuración", () => {
    it("tiene el límite correcto de 100 solicitudes", () => {
      expect(RATE_LIMIT_CONFIG.MAX_REQUESTS_PER_MINUTE).toBe(100);
    });

    it("tiene la ventana correcta de 60 segundos", () => {
      expect(RATE_LIMIT_CONFIG.WINDOW_DURATION_MS).toBe(60_000);
    });
  });

  describe("Flujo completo de rate limiting", () => {
    it("bloquea al alcanzar límite, restaura tras nueva ventana", async () => {
      const now = Date.now();

      // Consumir todas las solicitudes
      for (let i = 0; i < 100; i++) {
        const result = await checkRateLimit("tenant-1", now);
        expect(result.allowed).toBe(true);
      }

      // Verificar bloqueado
      const blocked = await checkRateLimit("tenant-1", now);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);

      // Avanzar a nueva ventana
      const newWindow = now + RATE_LIMIT_CONFIG.WINDOW_DURATION_MS;
      const restored = await checkRateLimit("tenant-1", newWindow);
      expect(restored.allowed).toBe(true);
      expect(restored.remaining).toBe(99);

      // Puede volver a consumir 100
      for (let i = 0; i < 99; i++) {
        const result = await checkRateLimit("tenant-1", newWindow);
        expect(result.allowed).toBe(true);
      }

      // Bloqueado de nuevo
      const blockedAgain = await checkRateLimit("tenant-1", newWindow);
      expect(blockedAgain.allowed).toBe(false);
    });
  });
});

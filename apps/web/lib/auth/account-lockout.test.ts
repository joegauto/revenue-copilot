import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  checkAccountLocked,
  recordFailedAttempt,
  resetFailedAttempts,
  LOCKOUT_CONFIG,
  _clearStore,
} from "./account-lockout";

describe("Account Lockout Service", () => {
  beforeEach(() => {
    _clearStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("checkAccountLocked", () => {
    it("retorna locked: false para una cuenta sin intentos fallidos", async () => {
      const result = await checkAccountLocked("user@example.com");
      expect(result.locked).toBe(false);
      expect(result.minutesRemaining).toBeUndefined();
    });

    it("retorna locked: true cuando la cuenta está bloqueada", async () => {
      // Generar 5 intentos fallidos para bloquear
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt("user@example.com");
      }

      const result = await checkAccountLocked("user@example.com");
      expect(result.locked).toBe(true);
      expect(result.minutesRemaining).toBe(15);
    });

    it("retorna locked: false cuando el bloqueo ha expirado", async () => {
      // Bloquear la cuenta
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt("user@example.com");
      }

      // Avanzar 15 minutos
      vi.advanceTimersByTime(LOCKOUT_CONFIG.LOCKOUT_DURATION_MS);

      const result = await checkAccountLocked("user@example.com");
      expect(result.locked).toBe(false);
    });

    it("calcula correctamente los minutos restantes", async () => {
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt("user@example.com");
      }

      // Avanzar 10 minutos (quedan 5)
      vi.advanceTimersByTime(10 * 60 * 1000);

      const result = await checkAccountLocked("user@example.com");
      expect(result.locked).toBe(true);
      expect(result.minutesRemaining).toBe(5);
    });

    it("normaliza el email (case-insensitive)", async () => {
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt("User@Example.COM");
      }

      const result = await checkAccountLocked("user@example.com");
      expect(result.locked).toBe(true);
    });
  });

  describe("recordFailedAttempt", () => {
    it("incrementa el contador de intentos fallidos", async () => {
      const result1 = await recordFailedAttempt("user@example.com");
      expect(result1.locked).toBe(false);
      expect(result1.attemptsRemaining).toBe(4);

      const result2 = await recordFailedAttempt("user@example.com");
      expect(result2.locked).toBe(false);
      expect(result2.attemptsRemaining).toBe(3);
    });

    it("bloquea la cuenta al alcanzar 5 intentos", async () => {
      let result;
      for (let i = 0; i < 4; i++) {
        result = await recordFailedAttempt("user@example.com");
        expect(result.locked).toBe(false);
      }

      // 5to intento — debe bloquear
      result = await recordFailedAttempt("user@example.com");
      expect(result.locked).toBe(true);
      expect(result.attemptsRemaining).toBe(0);
    });

    it("no bloquea con menos de 5 intentos", async () => {
      for (let i = 0; i < 4; i++) {
        const result = await recordFailedAttempt("user@example.com");
        expect(result.locked).toBe(false);
      }
    });

    it("retorna intentos restantes correctos", async () => {
      const r1 = await recordFailedAttempt("user@example.com");
      expect(r1.attemptsRemaining).toBe(4);

      const r2 = await recordFailedAttempt("user@example.com");
      expect(r2.attemptsRemaining).toBe(3);

      const r3 = await recordFailedAttempt("user@example.com");
      expect(r3.attemptsRemaining).toBe(2);

      const r4 = await recordFailedAttempt("user@example.com");
      expect(r4.attemptsRemaining).toBe(1);

      const r5 = await recordFailedAttempt("user@example.com");
      expect(r5.attemptsRemaining).toBe(0);
    });

    it("maneja cuentas diferentes de forma independiente", async () => {
      for (let i = 0; i < 4; i++) {
        await recordFailedAttempt("user1@example.com");
      }

      const result = await recordFailedAttempt("user2@example.com");
      expect(result.attemptsRemaining).toBe(4); // primer intento para user2
    });
  });

  describe("resetFailedAttempts", () => {
    it("reinicia el contador tras login exitoso", async () => {
      // Acumular 3 intentos fallidos
      await recordFailedAttempt("user@example.com");
      await recordFailedAttempt("user@example.com");
      await recordFailedAttempt("user@example.com");

      // Reiniciar
      await resetFailedAttempts("user@example.com");

      // Verificar que no está bloqueado y el contador se reinició
      const lockStatus = await checkAccountLocked("user@example.com");
      expect(lockStatus.locked).toBe(false);

      // Debe poder fallar 4 veces más sin bloquearse
      const result = await recordFailedAttempt("user@example.com");
      expect(result.attemptsRemaining).toBe(4);
    });

    it("funciona correctamente si no hay registro previo", async () => {
      // No debe lanzar error
      await expect(
        resetFailedAttempts("nonexistent@example.com")
      ).resolves.toBeUndefined();
    });

    it("normaliza el email al reiniciar", async () => {
      await recordFailedAttempt("User@Example.COM");
      await recordFailedAttempt("User@Example.COM");

      await resetFailedAttempts("user@example.com");

      const result = await recordFailedAttempt("user@example.com");
      expect(result.attemptsRemaining).toBe(4);
    });
  });

  describe("Flujo completo de bloqueo y desbloqueo", () => {
    it("bloquea tras 5 intentos, desbloquea tras 15 min, permite login", async () => {
      // 5 intentos fallidos
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt("user@example.com");
      }

      // Verificar bloqueado
      let status = await checkAccountLocked("user@example.com");
      expect(status.locked).toBe(true);

      // Avanzar 15 minutos
      vi.advanceTimersByTime(LOCKOUT_CONFIG.LOCKOUT_DURATION_MS);

      // Verificar desbloqueado
      status = await checkAccountLocked("user@example.com");
      expect(status.locked).toBe(false);

      // Simular login exitoso — reiniciar contador
      await resetFailedAttempts("user@example.com");

      // Verificar que el contador está en 0
      const result = await recordFailedAttempt("user@example.com");
      expect(result.attemptsRemaining).toBe(4);
    });

    it("el bloqueo no se desbloquea antes de 15 minutos", async () => {
      for (let i = 0; i < 5; i++) {
        await recordFailedAttempt("user@example.com");
      }

      // Avanzar 14 minutos (no suficiente)
      vi.advanceTimersByTime(14 * 60 * 1000);

      const status = await checkAccountLocked("user@example.com");
      expect(status.locked).toBe(true);
      expect(status.minutesRemaining).toBe(1);
    });
  });
});

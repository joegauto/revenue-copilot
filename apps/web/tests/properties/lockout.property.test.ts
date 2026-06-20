import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  checkAccountLocked,
  recordFailedAttempt,
  resetFailedAttempts,
  _clearStore,
  LOCKOUT_CONFIG,
} from "@/lib/auth/account-lockout";

/**
 * Property 16: Bloqueo de cuenta por intentos fallidos
 * Validates: Requirements 10.4
 */

beforeEach(() => {
  _clearStore();
});

describe("Property 16: Bloqueo de cuenta por intentos fallidos", () => {
  // Generador de emails válidos
  const emailArb = fc
    .tuple(
      fc.stringMatching(/^[a-z][a-z0-9]{1,10}$/),
      fc.stringMatching(/^[a-z]{2,6}$/)
    )
    .map(([local, domain]) => `${local}@${domain}.com`);

  it("para cualquier número de intentos 1-4, la cuenta NO se bloquea", async () => {
    await fc.assert(
      fc.asyncProperty(
        emailArb,
        fc.integer({ min: 1, max: LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS - 1 }),
        async (email, attempts) => {
          _clearStore();

          for (let i = 0; i < attempts; i++) {
            await recordFailedAttempt(email);
          }

          const result = await checkAccountLocked(email);
          expect(result.locked).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("al exactamente 5 intentos fallidos, la cuenta SE bloquea", async () => {
    await fc.assert(
      fc.asyncProperty(emailArb, async (email) => {
        _clearStore();

        for (let i = 0; i < LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS - 1; i++) {
          const result = await recordFailedAttempt(email);
          expect(result.locked).toBe(false);
        }

        // El 5to intento debe bloquear
        const finalResult = await recordFailedAttempt(email);
        expect(finalResult.locked).toBe(true);
        expect(finalResult.attemptsRemaining).toBe(0);

        // Verificar que checkAccountLocked también reporta bloqueado
        const lockStatus = await checkAccountLocked(email);
        expect(lockStatus.locked).toBe(true);
        expect(lockStatus.minutesRemaining).toBeGreaterThan(0);
      }),
      { numRuns: 200 }
    );
  });

  it("tras reset, el contador vuelve a 0 y se pueden fallar 4 veces más sin bloqueo", async () => {
    await fc.assert(
      fc.asyncProperty(
        emailArb,
        fc.integer({ min: 1, max: LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS - 1 }),
        async (email, initialAttempts) => {
          _clearStore();

          // Registrar algunos intentos fallidos (sin llegar al bloqueo)
          for (let i = 0; i < initialAttempts; i++) {
            await recordFailedAttempt(email);
          }

          // Reset simula login exitoso
          await resetFailedAttempts(email);

          // Después del reset, se pueden fallar hasta 4 veces sin bloqueo
          for (let i = 0; i < LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS - 1; i++) {
            const result = await recordFailedAttempt(email);
            expect(result.locked).toBe(false);
          }

          // El 5to intento después del reset sí bloquea
          const finalResult = await recordFailedAttempt(email);
          expect(finalResult.locked).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("para cualquier email con variaciones de mayúsculas/espacios, la normalización funciona correctamente", async () => {
    await fc.assert(
      fc.asyncProperty(emailArb, async (baseEmail) => {
        _clearStore();

        // Generar variaciones del mismo email
        const variations = [
          baseEmail.toUpperCase(),
          baseEmail.toLowerCase(),
          `  ${baseEmail}  `,
          baseEmail.charAt(0).toUpperCase() + baseEmail.slice(1),
        ];

        // Registrar intentos con distintas variaciones hasta alcanzar el bloqueo
        for (let i = 0; i < LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS; i++) {
          const variant = variations[i % variations.length];
          await recordFailedAttempt(variant);
        }

        // Verificar que todas las variaciones ven la cuenta bloqueada
        for (const variant of variations) {
          const result = await checkAccountLocked(variant);
          expect(result.locked).toBe(true);
        }
      }),
      { numRuns: 200 }
    );
  });
});

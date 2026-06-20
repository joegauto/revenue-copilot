import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  checkRateLimit,
  _clearStore,
  RATE_LIMIT_CONFIG,
} from "@/lib/rate-limit";

/**
 * Property 14: Rate limiting por tenant
 * Validates: Requirements 8.6, 8.7
 *
 * - Máximo 100 solicitudes por minuto por tenant.
 * - Solicitudes 1-100 se aceptan, 101+ se rechazan.
 * - Al inicio del siguiente minuto se restaura el acceso.
 * - Diferentes tenants tienen límites independientes.
 */

const { MAX_REQUESTS_PER_MINUTE, WINDOW_DURATION_MS } = RATE_LIMIT_CONFIG;

// Contador para generar tenantIds únicos por iteración
let iterationCounter = 0;

function uniqueTenantId(base: string): string {
  return `${base}_${iterationCounter++}`;
}

describe("Property 14: Rate limiting por tenant", () => {
  beforeEach(() => {
    _clearStore();
    iterationCounter = 0;
  });

  it("solicitudes 1-100 se aceptan para cualquier tenant", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: MAX_REQUESTS_PER_MINUTE }),
        async (numRequests) => {
          const tenantId = uniqueTenantId("tenant");
          const now = Date.now();

          for (let i = 0; i < numRequests; i++) {
            const result = await checkRateLimit(tenantId, now);
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(
              MAX_REQUESTS_PER_MINUTE - (i + 1)
            );
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("solicitud 101+ dentro de la misma ventana es rechazada", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 50 }),
        async (extraRequests) => {
          const tenantId = uniqueTenantId("tenant");
          const now = Date.now();

          // Agotar las 100 solicitudes permitidas
          for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) {
            await checkRateLimit(tenantId, now);
          }

          // Las solicitudes adicionales deben ser rechazadas
          for (let i = 0; i < extraRequests; i++) {
            const result = await checkRateLimit(tenantId, now);
            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("después de expirar la ventana (60s), se restaura el acceso", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 120_000 }),
        async (extraMs) => {
          const tenantId = uniqueTenantId("tenant");
          const now = Date.now();

          // Agotar las 100 solicitudes
          for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) {
            await checkRateLimit(tenantId, now);
          }

          // Verificar que está bloqueado
          const blocked = await checkRateLimit(tenantId, now);
          expect(blocked.allowed).toBe(false);

          // Avanzar el tiempo al menos WINDOW_DURATION_MS
          const futureTime = now + WINDOW_DURATION_MS + extraMs;
          const restored = await checkRateLimit(tenantId, futureTime);
          expect(restored.allowed).toBe(true);
          expect(restored.remaining).toBe(MAX_REQUESTS_PER_MINUTE - 1);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("diferentes tenants tienen límites independientes", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 100_000 }),
        async (seed) => {
          const tenantA = uniqueTenantId("tenantA");
          const tenantB = uniqueTenantId("tenantB");
          const now = Date.now();

          // Agotar el límite del tenant A
          for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) {
            await checkRateLimit(tenantA, now);
          }

          // Tenant A está bloqueado
          const blockedA = await checkRateLimit(tenantA, now);
          expect(blockedA.allowed).toBe(false);

          // Tenant B sigue teniendo acceso
          const allowedB = await checkRateLimit(tenantB, now);
          expect(allowedB.allowed).toBe(true);
          expect(allowedB.remaining).toBe(MAX_REQUESTS_PER_MINUTE - 1);
        }
      ),
      { numRuns: 200 }
    );
  });
});

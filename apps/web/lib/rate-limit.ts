/**
 * Rate Limiting por Tenant — Ventana deslizante de 1 minuto.
 *
 * Validates: Requirements 8.6, 8.7
 *
 * - Máximo 100 solicitudes por minuto por tenant.
 * - Usa ventana deslizante (sliding window) de 60 segundos.
 * - Rechaza solicitudes excedentes con código RATE_001 y header Retry-After.
 * - Restaura acceso automáticamente al inicio del siguiente minuto.
 *
 * Implementación en memoria (Map) con la misma interfaz que usaría Redis
 * (INCR + PEXPIRE). Preparado para migrar a Redis cuando se configure.
 */

const MAX_REQUESTS_PER_MINUTE = 100;
const WINDOW_DURATION_MS = 60 * 1000; // 1 minuto

interface RateLimitRecord {
  count: number;
  windowStart: number; // timestamp en ms
}

// Store en memoria — en producción se reemplaza por Redis INCR + PEXPIRE
// Key: tenantId
const rateLimitStore = new Map<string, RateLimitRecord>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

/**
 * Verifica si un tenant puede realizar una solicitud.
 *
 * Implementa ventana deslizante de 1 minuto:
 * - Si la ventana actual ha expirado, se reinicia el contador.
 * - Si el contador está por debajo del límite, se incrementa y se permite.
 * - Si el contador alcanza el límite, se rechaza con tiempo de espera.
 *
 * @param tenantId - Identificador único del tenant
 * @param now - Timestamp actual en ms (inyectable para testing)
 * @returns Resultado con allowed, remaining y resetInSeconds
 */
export async function checkRateLimit(
  tenantId: string,
  now: number = Date.now()
): Promise<RateLimitResult> {
  const record = rateLimitStore.get(tenantId);

  // Si no hay registro o la ventana ha expirado, iniciar nueva ventana
  if (!record || now - record.windowStart >= WINDOW_DURATION_MS) {
    rateLimitStore.set(tenantId, {
      count: 1,
      windowStart: now,
    });
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_MINUTE - 1,
      resetInSeconds: Math.ceil(WINDOW_DURATION_MS / 1000),
    };
  }

  // Calcular tiempo restante en la ventana actual
  const elapsedMs = now - record.windowStart;
  const remainingMs = WINDOW_DURATION_MS - elapsedMs;
  const resetInSeconds = Math.ceil(remainingMs / 1000);

  // Verificar si se ha alcanzado el límite
  if (record.count >= MAX_REQUESTS_PER_MINUTE) {
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds,
    };
  }

  // Incrementar contador y permitir
  record.count += 1;
  rateLimitStore.set(tenantId, record);

  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_MINUTE - record.count,
    resetInSeconds,
  };
}

// Exportar constantes para tests
export const RATE_LIMIT_CONFIG = {
  MAX_REQUESTS_PER_MINUTE,
  WINDOW_DURATION_MS,
} as const;

// Exportar para testing — permite limpiar el store entre tests
export function _clearStore(): void {
  rateLimitStore.clear();
}

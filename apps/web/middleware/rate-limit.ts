/**
 * Rate Limit Middleware — Función middleware para rutas de API.
 *
 * Validates: Requirements 8.6, 8.7
 *
 * Uso en API routes:
 * ```ts
 * import { withRateLimit } from '@/middleware/rate-limit';
 *
 * export async function GET(request: NextRequest) {
 *   const rateLimitResponse = await withRateLimit(request);
 *   if (rateLimitResponse) return rateLimitResponse; // 429 si excede límite
 *
 *   // ... lógica normal de la ruta
 * }
 * ```
 *
 * Si el tenant excede 100 solicitudes por minuto:
 * - Retorna HTTP 429 (Too Many Requests)
 * - Incluye código de error RATE_001
 * - Incluye header Retry-After con segundos hasta reset
 */

import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "../lib/rate-limit";

/**
 * Middleware de rate limiting para rutas de API.
 *
 * Extrae el tenantId del header x-tenant-id (inyectado por el middleware de auth)
 * y verifica el límite de solicitudes.
 *
 * @param request - NextRequest con headers de autenticación
 * @returns null si la solicitud está permitida, NextResponse 429 si excede el límite
 */
export async function withRateLimit(
  request: NextRequest
): Promise<NextResponse | null> {
  const tenantId = request.headers.get("x-tenant-id");

  // Si no hay tenantId, no aplicar rate limiting (la ruta es pública o el auth middleware no se ejecutó)
  if (!tenantId) {
    return null;
  }

  const result = await checkRateLimit(tenantId);

  if (!result.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RATE_001",
          message:
            "Rate limit exceeded. Maximum 100 requests per minute per tenant.",
          retryAfter: result.resetInSeconds,
        },
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(result.resetInSeconds),
          "X-RateLimit-Limit": "100",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(result.resetInSeconds),
        },
      }
    );
  }

  // Solicitud permitida — no retornar respuesta (null = continuar)
  return null;
}

/**
 * Helper para agregar headers de rate limit a una respuesta exitosa.
 * Útil para informar al cliente sobre su uso actual.
 */
export function addRateLimitHeaders(
  response: NextResponse,
  remaining: number,
  resetInSeconds: number
): NextResponse {
  response.headers.set("X-RateLimit-Limit", "100");
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  response.headers.set("X-RateLimit-Reset", String(resetInSeconds));
  return response;
}

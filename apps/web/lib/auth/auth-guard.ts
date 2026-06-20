/**
 * Auth Guard — Higher-Order Function para proteger API route handlers.
 *
 * Validates: Requirements 10.7, 10.8
 *
 * Extrae y verifica JWT, configura el contexto de tenant con runWithTenant,
 * y retorna respuestas de error estandarizadas para fallos de autenticación.
 */

import { NextResponse, type NextRequest } from "next/server";
import { verifyToken, type VerifiedPayload } from "./jwt";
import { runWithTenant } from "../tenant-context";

/** Códigos de error estandarizados para autenticación */
export const AUTH_ERROR_CODES = {
  AUTH_001: { code: "AUTH_001", message: "Invalid credentials" },
  AUTH_002: { code: "AUTH_002", message: "Account locked" },
  AUTH_003: { code: "AUTH_003", message: "Token expired" },
  AUTH_004: { code: "AUTH_004", message: "Insufficient permissions" },
} as const;

export type AuthErrorKey = keyof typeof AUTH_ERROR_CODES;

/**
 * Contexto de autenticación disponible dentro del handler protegido.
 */
export interface AuthContext {
  tenantId: string;
  userId: string;
  email: string;
}

/**
 * Tipo del handler protegido que recibe request + contexto de auth.
 */
export type AuthenticatedHandler = (
  request: NextRequest,
  context: AuthContext
) => Promise<NextResponse> | NextResponse;

/**
 * Crea una respuesta de error estandarizada.
 */
export function createAuthErrorResponse(
  errorKey: AuthErrorKey,
  status: number,
  details?: unknown
): NextResponse {
  const error = AUTH_ERROR_CODES[errorKey];
  return NextResponse.json(
    {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(details !== undefined && { details }),
      },
    },
    { status }
  );
}

/**
 * Extrae el Bearer token del header Authorization.
 * Retorna null si no hay token válido.
 */
export function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7);
  return token || null;
}

/**
 * Higher-Order Function que envuelve un API route handler con autenticación.
 *
 * - Extrae y verifica el JWT del header Authorization.
 * - Configura el contexto de tenant con runWithTenant.
 * - Retorna errores estandarizados si la autenticación falla.
 *
 * @example
 * ```ts
 * export const GET = withAuth(async (request, { tenantId, userId }) => {
 *   const leads = await prisma.lead.findMany();
 *   return NextResponse.json({ success: true, data: leads });
 * });
 * ```
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // 1. Extraer token
    const token = extractBearerToken(request);
    if (!token) {
      return createAuthErrorResponse("AUTH_001", 401);
    }

    // 2. Verificar token
    let payload: VerifiedPayload;
    try {
      payload = await verifyToken(token);
    } catch (error: unknown) {
      // Distinguir entre token expirado y token inválido
      if (
        error instanceof Error &&
        (error.message.includes("exp") ||
          error.message.includes("expired") ||
          error.name === "JWTExpired")
      ) {
        return createAuthErrorResponse("AUTH_003", 401);
      }
      return createAuthErrorResponse("AUTH_001", 401);
    }

    // 3. Verificar permisos de tenant sobre el recurso
    const urlTenantId = request.nextUrl.searchParams.get("tenantId");
    if (urlTenantId && urlTenantId !== payload.tenantId) {
      return createAuthErrorResponse("AUTH_004", 403);
    }

    // 4. Construir contexto de auth
    const authContext: AuthContext = {
      tenantId: payload.tenantId,
      userId: payload.userId,
      email: payload.email,
    };

    // 5. Ejecutar handler dentro del contexto de tenant
    return runWithTenant(payload.tenantId, () => handler(request, authContext));
  };
}

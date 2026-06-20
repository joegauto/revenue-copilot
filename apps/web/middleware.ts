/**
 * Next.js Middleware — Protección de rutas del dashboard y API.
 *
 * Validates: Requirements 10.7, 10.8
 *
 * - Valida JWT en cada request a rutas protegidas.
 * - Verifica que el tenant tiene permisos sobre el recurso solicitado.
 * - Retorna errores estandarizados (AUTH_001 a AUTH_004).
 *
 * Rutas protegidas:
 *   /api/* (excepto /api/auth/*, /api/webhooks/*)
 *   /(dashboard)/*
 *
 * Rutas públicas:
 *   /api/auth/login, /api/auth/register, /api/webhooks/*
 */

import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/** Códigos de error estandarizados */
const AUTH_ERRORS = {
  AUTH_001: { code: "AUTH_001", message: "Invalid credentials" },
  AUTH_002: { code: "AUTH_002", message: "Account locked" },
  AUTH_003: { code: "AUTH_003", message: "Token expired" },
  AUTH_004: { code: "AUTH_004", message: "Insufficient permissions" },
} as const;

/**
 * Rutas que no requieren autenticación.
 */
const PUBLIC_PATHS = ["/api/auth/login", "/api/auth/register", "/api/webhooks"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (publicPath) =>
      pathname === publicPath || pathname.startsWith(publicPath + "/")
  );
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set.");
  }
  return new TextEncoder().encode(secret);
}

function createErrorResponse(
  errorKey: keyof typeof AUTH_ERRORS,
  status: number
): NextResponse {
  const error = AUTH_ERRORS[errorKey];
  return NextResponse.json(
    {
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    },
    { status }
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permitir rutas públicas sin autenticación
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Extraer Bearer token del header Authorization
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return createErrorResponse("AUTH_001", 401);
  }

  const token = authHeader.slice(7); // Remover "Bearer "

  if (!token) {
    return createErrorResponse("AUTH_001", 401);
  }

  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);

    // Verificar campos requeridos en el payload
    if (!payload.tenantId || !payload.userId || !payload.email) {
      return createErrorResponse("AUTH_001", 401);
    }

    // Verificar que el tenant tiene permisos sobre el recurso solicitado.
    // Para rutas de API con tenantId en el path o query, validar que coincida.
    const urlTenantId = request.nextUrl.searchParams.get("tenantId");
    if (urlTenantId && urlTenantId !== payload.tenantId) {
      return createErrorResponse("AUTH_004", 403);
    }

    // Agregar info del tenant a los headers para uso downstream
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-tenant-id", payload.tenantId as string);
    requestHeaders.set("x-user-id", payload.userId as string);
    requestHeaders.set("x-user-email", payload.email as string);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error: unknown) {
    // Distinguir entre token expirado y token inválido
    if (
      error instanceof Error &&
      (error.message.includes("exp") ||
        error.message.includes("expired") ||
        error.name === "JWTExpired")
    ) {
      return createErrorResponse("AUTH_003", 401);
    }

    // Token inválido (malformado, firma incorrecta, etc.)
    return createErrorResponse("AUTH_001", 401);
  }
}

/**
 * Configuración del matcher de Next.js.
 * Protege rutas de API (excepto auth y webhooks) y rutas del dashboard.
 */
export const config = {
  matcher: ["/api/:path((?!auth|webhooks).*)", "/(dashboard)/:path*"],
};

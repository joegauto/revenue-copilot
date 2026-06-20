/**
 * Unit tests para auth-guard.ts
 * Validates: Requirements 10.7, 10.8
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import {
  withAuth,
  extractBearerToken,
  createAuthErrorResponse,
  type AuthContext,
} from "./auth-guard";

// Mock del módulo JWT
vi.mock("./jwt", () => ({
  verifyToken: vi.fn(),
}));

import { verifyToken } from "./jwt";

const mockedVerifyToken = vi.mocked(verifyToken);

/**
 * Helper para crear un NextRequest con headers personalizados.
 */
function createMockRequest(
  url: string,
  options?: { authorization?: string }
): NextRequest {
  const headers = new Headers();
  if (options?.authorization) {
    headers.set("authorization", options.authorization);
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), { headers });
}

describe("extractBearerToken", () => {
  it("extrae token de un header Authorization válido", () => {
    const request = createMockRequest("http://localhost:3000/api/leads", {
      authorization: "Bearer my-jwt-token",
    });
    expect(extractBearerToken(request)).toBe("my-jwt-token");
  });

  it("retorna null si no hay header Authorization", () => {
    const request = createMockRequest("http://localhost:3000/api/leads");
    expect(extractBearerToken(request)).toBeNull();
  });

  it("retorna null si el header no empieza con Bearer", () => {
    const request = createMockRequest("http://localhost:3000/api/leads", {
      authorization: "Basic abc123",
    });
    expect(extractBearerToken(request)).toBeNull();
  });

  it("retorna null si el token está vacío después de Bearer", () => {
    const request = createMockRequest("http://localhost:3000/api/leads", {
      authorization: "Bearer ",
    });
    expect(extractBearerToken(request)).toBeNull();
  });
});

describe("createAuthErrorResponse", () => {
  it("crea respuesta AUTH_001 con status 401", async () => {
    const response = createAuthErrorResponse("AUTH_001", 401);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      success: false,
      error: {
        code: "AUTH_001",
        message: "Invalid credentials",
      },
    });
  });

  it("crea respuesta AUTH_003 con status 401", async () => {
    const response = createAuthErrorResponse("AUTH_003", 401);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("AUTH_003");
    expect(body.error.message).toBe("Token expired");
  });

  it("crea respuesta AUTH_004 con status 403", async () => {
    const response = createAuthErrorResponse("AUTH_004", 403);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("AUTH_004");
    expect(body.error.message).toBe("Insufficient permissions");
  });

  it("incluye details cuando se proporcionan", async () => {
    const response = createAuthErrorResponse("AUTH_002", 403, {
      lockedUntil: "2025-01-01T00:00:00Z",
    });
    const body = await response.json();

    expect(body.error.details).toEqual({
      lockedUntil: "2025-01-01T00:00:00Z",
    });
  });
});

describe("withAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retorna 401 si no hay header Authorization", async () => {
    const handler = vi.fn();
    const protectedHandler = withAuth(handler);

    const request = createMockRequest("http://localhost:3000/api/leads");
    const response = await protectedHandler(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("AUTH_001");
    expect(handler).not.toHaveBeenCalled();
  });

  it("retorna 401 si el token es inválido", async () => {
    mockedVerifyToken.mockRejectedValue(new Error("Invalid token signature"));

    const handler = vi.fn();
    const protectedHandler = withAuth(handler);

    const request = createMockRequest("http://localhost:3000/api/leads", {
      authorization: "Bearer invalid-token",
    });
    const response = await protectedHandler(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("AUTH_001");
    expect(handler).not.toHaveBeenCalled();
  });

  it("retorna 401 con AUTH_003 si el token ha expirado", async () => {
    const expiredError = new Error('"exp" claim timestamp check failed');
    expiredError.name = "JWTExpired";
    mockedVerifyToken.mockRejectedValue(expiredError);

    const handler = vi.fn();
    const protectedHandler = withAuth(handler);

    const request = createMockRequest("http://localhost:3000/api/leads", {
      authorization: "Bearer expired-token",
    });
    const response = await protectedHandler(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("AUTH_003");
    expect(body.error.message).toBe("Token expired");
    expect(handler).not.toHaveBeenCalled();
  });

  it("retorna 403 con AUTH_004 si el tenant no tiene permisos sobre el recurso", async () => {
    mockedVerifyToken.mockResolvedValue({
      tenantId: "tenant-a",
      userId: "user-1",
      email: "user@tenant-a.com",
    } as any);

    const handler = vi.fn();
    const protectedHandler = withAuth(handler);

    // El token es de tenant-a pero intenta acceder a datos de tenant-b
    const request = createMockRequest(
      "http://localhost:3000/api/leads?tenantId=tenant-b",
      { authorization: "Bearer valid-token" }
    );
    const response = await protectedHandler(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("AUTH_004");
    expect(body.error.message).toBe("Insufficient permissions");
    expect(handler).not.toHaveBeenCalled();
  });

  it("ejecuta el handler con contexto de auth cuando el token es válido", async () => {
    const mockPayload = {
      tenantId: "tenant-123",
      userId: "user-456",
      email: "admin@company.com",
    };
    mockedVerifyToken.mockResolvedValue(mockPayload as any);

    const handler = vi.fn().mockImplementation((_req, ctx: AuthContext) => {
      return new Response(JSON.stringify({ tenantId: ctx.tenantId }), {
        status: 200,
      });
    });
    const protectedHandler = withAuth(handler);

    const request = createMockRequest("http://localhost:3000/api/leads", {
      authorization: "Bearer valid-token",
    });
    await protectedHandler(request);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(request, {
      tenantId: "tenant-123",
      userId: "user-456",
      email: "admin@company.com",
    });
  });

  it("permite acceso cuando tenantId en URL coincide con el del token", async () => {
    const mockPayload = {
      tenantId: "tenant-123",
      userId: "user-456",
      email: "admin@company.com",
    };
    mockedVerifyToken.mockResolvedValue(mockPayload as any);

    const handler = vi.fn().mockImplementation((_req, ctx: AuthContext) => {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    const protectedHandler = withAuth(handler);

    const request = createMockRequest(
      "http://localhost:3000/api/leads?tenantId=tenant-123",
      { authorization: "Bearer valid-token" }
    );
    await protectedHandler(request);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("permite acceso cuando no hay tenantId en la URL", async () => {
    const mockPayload = {
      tenantId: "tenant-123",
      userId: "user-456",
      email: "admin@company.com",
    };
    mockedVerifyToken.mockResolvedValue(mockPayload as any);

    const handler = vi.fn().mockImplementation(() => {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    const protectedHandler = withAuth(handler);

    const request = createMockRequest("http://localhost:3000/api/leads", {
      authorization: "Bearer valid-token",
    });
    await protectedHandler(request);

    expect(handler).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { withRateLimit } from "./rate-limit";
import { _clearStore, checkRateLimit } from "../lib/rate-limit";

function createMockRequest(tenantId: string | null): NextRequest {
  const headers = new Headers();
  if (tenantId) {
    headers.set("x-tenant-id", tenantId);
  }
  return new NextRequest("http://localhost:3000/api/leads", {
    headers,
  });
}

describe("Rate Limit Middleware", () => {
  beforeEach(() => {
    _clearStore();
  });

  it("retorna null (permite) cuando no hay x-tenant-id", async () => {
    const request = createMockRequest(null);
    const result = await withRateLimit(request);
    expect(result).toBeNull();
  });

  it("retorna null (permite) para solicitudes dentro del límite", async () => {
    const request = createMockRequest("tenant-1");
    const result = await withRateLimit(request);
    expect(result).toBeNull();
  });

  it("retorna 429 cuando se excede el límite", async () => {
    const now = Date.now();
    // Consumir las 100 solicitudes directamente en el store
    for (let i = 0; i < 100; i++) {
      await checkRateLimit("tenant-1", now);
    }

    const request = createMockRequest("tenant-1");
    const result = await withRateLimit(request);

    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);

    const body = await result!.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("RATE_001");
    expect(body.error.message).toContain("Rate limit exceeded");
    expect(body.error.retryAfter).toBeGreaterThan(0);
  });

  it("incluye header Retry-After en respuesta 429", async () => {
    const now = Date.now();
    for (let i = 0; i < 100; i++) {
      await checkRateLimit("tenant-1", now);
    }

    const request = createMockRequest("tenant-1");
    const result = await withRateLimit(request);

    expect(result).not.toBeNull();
    expect(result!.headers.get("Retry-After")).toBeTruthy();
    expect(Number(result!.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("incluye headers X-RateLimit-* en respuesta 429", async () => {
    const now = Date.now();
    for (let i = 0; i < 100; i++) {
      await checkRateLimit("tenant-1", now);
    }

    const request = createMockRequest("tenant-1");
    const result = await withRateLimit(request);

    expect(result).not.toBeNull();
    expect(result!.headers.get("X-RateLimit-Limit")).toBe("100");
    expect(result!.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(result!.headers.get("X-RateLimit-Reset")).toBeTruthy();
  });

  it("no afecta a otros tenants cuando uno está limitado", async () => {
    const now = Date.now();
    // Agotar tenant-1
    for (let i = 0; i < 100; i++) {
      await checkRateLimit("tenant-1", now);
    }

    // tenant-2 debe pasar
    const request = createMockRequest("tenant-2");
    const result = await withRateLimit(request);
    expect(result).toBeNull();
  });
});

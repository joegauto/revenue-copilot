/**
 * Property-based tests para resolución de identidad de leads.
 *
 * Property 4: Resolución de identidad de lead
 * - Mensajes con atributo coincidente resuelven al lead existente
 * - No se crean duplicados para el mismo contacto
 *
 * Valida: Requisito 1.7
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fc from "fast-check";

// Mock Prisma before import
vi.mock("../prisma", () => ({
  prisma: {},
}));

import { resolveLeadIdentity } from "./identity-resolver";

function createMockPrisma(existingLeads: Array<Record<string, unknown>>) {
  return {
    lead: {
      findFirst: vi.fn(async ({ where }: any) => {
        return (
          existingLeads.find(
            (l) =>
              l.tenantId === where.tenantId &&
              ((where.phone && l.phone === where.phone) ||
                (where.email && l.email === where.email) ||
                (where.webSessionId && l.webSessionId === where.webSessionId))
          ) || null
        );
      }),
      create: vi.fn(async ({ data }: any) => ({
        id: `new-${Date.now()}-${Math.random()}`,
        ...data,
        score: 0,
        status: "new",
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    },
  } as any;
}

describe("Property 4: Resolución de identidad de lead", () => {
  it("mensajes con phone coincidente resuelven al lead existente", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 8, maxLength: 15 }),
        fc.string({ minLength: 3, maxLength: 10 }),
        async (phone, tenantId) => {
          const existingLead = {
            id: "lead-existing",
            tenantId,
            phone,
            email: null,
            webSessionId: null,
          };
          const mockPrisma = createMockPrisma([existingLead]);

          const result = await resolveLeadIdentity(
            { tenantId, phone, channel: "whatsapp" },
            mockPrisma
          );
          expect(result.isNew).toBe(false);
          expect(result.lead.id).toBe("lead-existing");
        }
      ),
      { numRuns: 200 }
    );
  });

  it("no se crean duplicados — mismo contacto siempre resuelve al mismo lead", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.integer({ min: 1, max: 10 }),
        async (email, callCount) => {
          const tenantId = "tenant-1";
          const existingLead = {
            id: "lead-1",
            tenantId,
            phone: null,
            email,
            webSessionId: null,
          };
          const mockPrisma = createMockPrisma([existingLead]);

          const promises = Array.from({ length: callCount }, () =>
            resolveLeadIdentity({ tenantId, email, channel: "email" }, mockPrisma)
          );

          const results = await Promise.all(promises);
          // Todos resuelven al mismo lead
          for (const r of results) {
            expect(r.isNew).toBe(false);
            expect(r.lead.id).toBe("lead-1");
          }
          // Nunca se llamó a create
          expect(mockPrisma.lead.create).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 200 }
    );
  });

  it("contacto sin match crea lead nuevo con score 0", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 20 }),
        async (phone) => {
          const mockPrisma = createMockPrisma([]); // sin leads existentes

          const result = await resolveLeadIdentity(
            { tenantId: "tenant-1", phone, channel: "whatsapp" },
            mockPrisma
          );
          expect(result.isNew).toBe(true);
          expect(result.lead.score).toBe(0);
          expect(result.lead.status).toBe("new");
        }
      ),
      { numRuns: 200 }
    );
  });
});

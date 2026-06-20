import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerTenantMiddleware } from "./prisma-middleware";
import { runWithTenant } from "./tenant-context";

/**
 * Mock de PrismaClient para testear el middleware sin conexión a DB.
 * Simula el comportamiento de prisma.$use() capturando el middleware
 * y permitiendo invocar operaciones con params controlados.
 */
function createMockPrisma() {
  type MiddlewareFn = (
    params: { model?: string; action: string; args: Record<string, unknown> },
    next: (params: unknown) => Promise<unknown>
  ) => Promise<unknown>;

  const middlewares: MiddlewareFn[] = [];

  const mockPrisma = {
    $use: (fn: MiddlewareFn) => {
      middlewares.push(fn);
    },
  };

  /**
   * Ejecuta una operación simulada a través del middleware registrado.
   */
  async function executeOperation(
    model: string,
    action: string,
    args: Record<string, unknown> = {}
  ): Promise<{ params: Record<string, unknown>; result: unknown }> {
    let capturedParams: Record<string, unknown> = {};
    const next = vi.fn(async (params: unknown) => {
      capturedParams = params as Record<string, unknown>;
      return { mocked: true };
    });

    const params = { model, action, args };

    // Ejecutar todos los middlewares en cadena
    let result: unknown;
    if (middlewares.length > 0) {
      result = await middlewares[0](params, next);
    }

    return { params: params as unknown as Record<string, unknown>, result };
  }

  return { mockPrisma, executeOperation };
}

describe("prisma-middleware", () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>["mockPrisma"];
  let executeOperation: ReturnType<typeof createMockPrisma>["executeOperation"];

  beforeEach(() => {
    const mock = createMockPrisma();
    mockPrisma = mock.mockPrisma;
    executeOperation = mock.executeOperation;
    registerTenantMiddleware(mockPrisma as never);
  });

  describe("read operations (findMany, findFirst, findUnique)", () => {
    it("injects tenantId in WHERE for findMany on tenant models", async () => {
      const tenantId = "tenant-123";

      await runWithTenant(tenantId, async () => {
        await executeOperation("Lead", "findMany", { where: { status: "new" } });
      });

      // Verificar que el middleware modificó los args
      await runWithTenant(tenantId, async () => {
        const args = { where: { status: "new" } };
        await executeOperation("Lead", "findMany", args);
        expect(args.where).toEqual({ status: "new", tenantId: "tenant-123" });
      });
    });

    it("injects tenantId in WHERE for findFirst", async () => {
      const tenantId = "tenant-456";

      await runWithTenant(tenantId, async () => {
        const args = { where: { email: "test@example.com" } };
        await executeOperation("TenantUser", "findFirst", args);
        expect(args.where).toEqual({
          email: "test@example.com",
          tenantId: "tenant-456",
        });
      });
    });

    it("injects tenantId in WHERE for findUnique", async () => {
      const tenantId = "tenant-789";

      await runWithTenant(tenantId, async () => {
        const args = { where: { id: "some-id" } };
        await executeOperation("Conversation", "findUnique", args);
        expect(args.where).toEqual({ id: "some-id", tenantId: "tenant-789" });
      });
    });

    it("creates WHERE object if not provided", async () => {
      const tenantId = "tenant-abc";

      await runWithTenant(tenantId, async () => {
        const args: Record<string, unknown> = {};
        await executeOperation("Lead", "findMany", args);
        expect(args.where).toEqual({ tenantId: "tenant-abc" });
      });
    });

    it("filters Tenant model by id instead of tenantId", async () => {
      const tenantId = "tenant-self";

      await runWithTenant(tenantId, async () => {
        const args = { where: {} };
        await executeOperation("Tenant", "findFirst", args);
        expect(args.where).toEqual({ id: "tenant-self" });
      });
    });

    it("injects count operation filter", async () => {
      const tenantId = "tenant-count";

      await runWithTenant(tenantId, async () => {
        const args = { where: { status: "active" } };
        await executeOperation("Lead", "count", args);
        expect(args.where).toEqual({ status: "active", tenantId: "tenant-count" });
      });
    });
  });

  describe("create operations", () => {
    it("injects tenantId in data for create", async () => {
      const tenantId = "tenant-create";

      await runWithTenant(tenantId, async () => {
        const args = { data: { name: "New Lead", email: "lead@test.com" } };
        await executeOperation("Lead", "create", args);
        expect(args.data).toEqual({
          name: "New Lead",
          email: "lead@test.com",
          tenantId: "tenant-create",
        });
      });
    });

    it("does not override explicitly provided tenantId", async () => {
      const tenantId = "tenant-context";

      await runWithTenant(tenantId, async () => {
        const args = {
          data: { name: "Lead", tenantId: "tenant-explicit" },
        };
        await executeOperation("Lead", "create", args);
        expect(args.data).toEqual({
          name: "Lead",
          tenantId: "tenant-explicit",
        });
      });
    });

    it("injects tenantId in createMany data array", async () => {
      const tenantId = "tenant-many";

      await runWithTenant(tenantId, async () => {
        const args = {
          data: [
            { name: "Lead 1" },
            { name: "Lead 2" },
          ],
        };
        await executeOperation("Lead", "createMany", args);
        expect(args.data).toEqual([
          { name: "Lead 1", tenantId: "tenant-many" },
          { name: "Lead 2", tenantId: "tenant-many" },
        ]);
      });
    });

    it("does not inject tenantId for Tenant model create", async () => {
      const tenantId = "tenant-new";

      await runWithTenant(tenantId, async () => {
        const args = { data: { name: "New Tenant", email: "new@test.com" } };
        await executeOperation("Tenant", "create", args);
        // Tenant model should not get tenantId injected in data
        expect(args.data).toEqual({ name: "New Tenant", email: "new@test.com" });
      });
    });
  });

  describe("update/delete operations", () => {
    it("injects tenantId in WHERE for update", async () => {
      const tenantId = "tenant-update";

      await runWithTenant(tenantId, async () => {
        const args = {
          where: { id: "lead-1" },
          data: { score: 80 },
        };
        await executeOperation("Lead", "update", args);
        expect(args.where).toEqual({ id: "lead-1", tenantId: "tenant-update" });
      });
    });

    it("injects tenantId in WHERE for delete", async () => {
      const tenantId = "tenant-delete";

      await runWithTenant(tenantId, async () => {
        const args = { where: { id: "lead-to-delete" } };
        await executeOperation("Lead", "delete", args);
        expect(args.where).toEqual({
          id: "lead-to-delete",
          tenantId: "tenant-delete",
        });
      });
    });

    it("injects tenantId in WHERE for deleteMany", async () => {
      const tenantId = "tenant-del-many";

      await runWithTenant(tenantId, async () => {
        const args = { where: { status: "cold" } };
        await executeOperation("Lead", "deleteMany", args);
        expect(args.where).toEqual({ status: "cold", tenantId: "tenant-del-many" });
      });
    });
  });

  describe("no tenant context", () => {
    it("does not modify args when no tenant context is active", async () => {
      const args = { where: { status: "new" } };
      await executeOperation("Lead", "findMany", args);
      // Should remain unchanged
      expect(args.where).toEqual({ status: "new" });
    });
  });

  describe("non-tenant models", () => {
    it("does not modify args for models without tenantId", async () => {
      const tenantId = "tenant-xyz";

      await runWithTenant(tenantId, async () => {
        // A hypothetical model that doesn't have tenantId
        const args = { where: { id: "some-id" } };
        await executeOperation("SomeOtherModel", "findMany", args);
        expect(args.where).toEqual({ id: "some-id" });
      });
    });
  });

  describe("relation-based models (Message, ScoreHistory, FollowUpStep)", () => {
    it("injects tenant filter via relation for Message model", async () => {
      const tenantId = "tenant-msg";

      await runWithTenant(tenantId, async () => {
        const args = { where: { direction: "inbound" } };
        await executeOperation("Message", "findMany", args);
        expect(args.where).toEqual({
          direction: "inbound",
          conversation: { tenantId: "tenant-msg" },
        });
      });
    });

    it("injects tenant filter via relation for ScoreHistory model", async () => {
      const tenantId = "tenant-score";

      await runWithTenant(tenantId, async () => {
        const args = { where: {} };
        await executeOperation("ScoreHistory", "findMany", args);
        expect(args.where).toEqual({
          lead: { tenantId: "tenant-score" },
        });
      });
    });

    it("injects tenant filter via relation for FollowUpStep model", async () => {
      const tenantId = "tenant-step";

      await runWithTenant(tenantId, async () => {
        const args = { where: { stepNumber: 1 } };
        await executeOperation("FollowUpStep", "findMany", args);
        expect(args.where).toEqual({
          stepNumber: 1,
          sequence: { tenantId: "tenant-step" },
        });
      });
    });
  });
});

import { describe, it, expect } from "vitest";
import {
  runWithTenant,
  getCurrentTenantId,
  requireTenantId,
} from "./tenant-context";

describe("tenant-context", () => {
  describe("getCurrentTenantId", () => {
    it("returns undefined when no tenant context is active", () => {
      expect(getCurrentTenantId()).toBeUndefined();
    });

    it("returns the tenantId within a runWithTenant context", () => {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      runWithTenant(tenantId, () => {
        expect(getCurrentTenantId()).toBe(tenantId);
      });
    });

    it("returns undefined after the context exits", () => {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      runWithTenant(tenantId, () => {
        // inside context
      });
      expect(getCurrentTenantId()).toBeUndefined();
    });
  });

  describe("runWithTenant", () => {
    it("returns the value from the callback", () => {
      const result = runWithTenant("tenant-1", () => 42);
      expect(result).toBe(42);
    });

    it("supports async callbacks", async () => {
      const result = await runWithTenant("tenant-1", async () => {
        return getCurrentTenantId();
      });
      expect(result).toBe("tenant-1");
    });

    it("isolates nested contexts", () => {
      runWithTenant("tenant-outer", () => {
        expect(getCurrentTenantId()).toBe("tenant-outer");

        runWithTenant("tenant-inner", () => {
          expect(getCurrentTenantId()).toBe("tenant-inner");
        });

        // Outer context is restored
        expect(getCurrentTenantId()).toBe("tenant-outer");
      });
    });

    it("isolates concurrent contexts", async () => {
      const results: string[] = [];

      await Promise.all([
        runWithTenant("tenant-a", async () => {
          await new Promise((r) => setTimeout(r, 10));
          results.push(getCurrentTenantId()!);
        }),
        runWithTenant("tenant-b", async () => {
          await new Promise((r) => setTimeout(r, 5));
          results.push(getCurrentTenantId()!);
        }),
      ]);

      expect(results).toContain("tenant-a");
      expect(results).toContain("tenant-b");
    });
  });

  describe("requireTenantId", () => {
    it("throws when no tenant context is active", () => {
      expect(() => requireTenantId()).toThrow(
        "No tenant context found"
      );
    });

    it("returns tenantId when context is active", () => {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      runWithTenant(tenantId, () => {
        expect(requireTenantId()).toBe(tenantId);
      });
    });
  });
});

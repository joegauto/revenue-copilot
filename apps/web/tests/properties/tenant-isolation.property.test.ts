import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";

/**
 * Property 13: Aislamiento completo de datos entre tenants
 * Validates: Requirements 8.2
 *
 * Verifica que el middleware de Prisma garantiza aislamiento total entre tenants:
 * - Para cualquier par de tenants (A, B), queries en contexto de A siempre filtran por tenantId=A
 * - Operaciones de creación en contexto de A siempre inyectan tenantId=A
 * - Intentos cross-tenant retornan vacío sin revelar existencia del otro tenant
 */

// We mock the tenant-context module so we can control getCurrentTenantId
let mockCurrentTenantId: string | undefined = undefined;

vi.mock("@/lib/tenant-context", () => ({
  getCurrentTenantId: () => mockCurrentTenantId,
  runWithTenant: <T>(tenantId: string, fn: () => T): T => {
    const prev = mockCurrentTenantId;
    mockCurrentTenantId = tenantId;
    try {
      return fn();
    } finally {
      mockCurrentTenantId = prev;
    }
  },
  requireTenantId: () => {
    if (!mockCurrentTenantId) {
      throw new Error("No tenant context found.");
    }
    return mockCurrentTenantId;
  },
}));

// Import after mocking
import { registerTenantMiddleware } from "@/lib/prisma-middleware";

/**
 * Arbitrary para generar UUIDs válidos como tenant IDs.
 */
const tenantIdArb = fc.uuid();

/**
 * Arbitrary para generar pares de tenant IDs distintos.
 */
const tenantPairArb = fc
  .tuple(tenantIdArb, tenantIdArb)
  .filter(([a, b]) => a !== b);

/**
 * Modelos que tienen tenantId directo (excluyendo "Tenant" que usa id).
 */
const DIRECT_TENANT_MODELS = [
  "Lead",
  "Conversation",
  "ScoringConfig",
  "FollowUpSequence",
  "Appointment",
  "CalendarConfig",
  "KnowledgeEntry",
  "WhatsAppConfig",
  "ConversationTemplate",
  "MetricSnapshot",
  "TenantUser",
];

/**
 * Modelos con relación indirecta a tenant.
 */
const RELATION_TENANT_MODELS: Record<string, string> = {
  Message: "conversation",
  ScoreHistory: "lead",
  FollowUpStep: "sequence",
  FollowUpExecution: "sequence",
};

const directModelArb = fc.constantFrom(...DIRECT_TENANT_MODELS);
const relationModelArb = fc.constantFrom(
  ...Object.keys(RELATION_TENANT_MODELS)
);
const allTenantModelArb = fc.constantFrom(
  ...DIRECT_TENANT_MODELS,
  ...Object.keys(RELATION_TENANT_MODELS)
);

const readActionArb = fc.constantFrom(
  "findMany",
  "findFirst",
  "findUnique",
  "findFirstOrThrow",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy"
);

const writeActionArb = fc.constantFrom(
  "update",
  "updateMany",
  "delete",
  "deleteMany"
);

/**
 * Helper: ejecuta el middleware de Prisma y captura los params procesados.
 * Simula el flujo de Prisma.$use registrando el middleware y pasando params.
 */
function runMiddleware(
  tenantId: string | undefined,
  model: string,
  action: string,
  initialArgs: Record<string, unknown> = {}
): Promise<{ args: Record<string, unknown>; model: string; action: string }> {
  return new Promise((resolve) => {
    // Capture the middleware function
    let middlewareFn: ((params: any, next: (params: any) => any) => any) | null =
      null;

    const mockPrisma = {
      $use: (fn: (params: any, next: (params: any) => any) => any) => {
        middlewareFn = fn;
      },
    } as any;

    // Register the middleware
    registerTenantMiddleware(mockPrisma);

    // Set the tenant context
    mockCurrentTenantId = tenantId;

    // Create params object (deep clone initialArgs to avoid mutation issues)
    const params = {
      model,
      action,
      args: JSON.parse(JSON.stringify(initialArgs)),
      dataPath: [],
      runInTransaction: false,
    };

    // The "next" function captures the final processed params
    const next = (processedParams: any) => {
      resolve({
        args: processedParams.args,
        model: processedParams.model,
        action: processedParams.action,
      });
      return Promise.resolve(null);
    };

    // Execute the middleware
    middlewareFn!(params, next);
  });
}

describe("Property 13: Aislamiento completo de datos entre tenants", () => {
  beforeEach(() => {
    mockCurrentTenantId = undefined;
  });

  it("para cualquier par de tenants (A, B), queries de lectura en contexto de A siempre inyectan tenantId=A en WHERE", async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantPairArb,
        directModelArb,
        readActionArb,
        async ([tenantA, tenantB], model, action) => {
          const result = await runMiddleware(tenantA, model, action);

          // El WHERE debe contener tenantId del tenant A
          const where = result.args.where as Record<string, unknown>;
          expect(where).toBeDefined();
          expect(where.tenantId).toBe(tenantA);

          // El WHERE nunca debe contener el tenantId del tenant B
          expect(where.tenantId).not.toBe(tenantB);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("para cualquier par de tenants (A, B), operaciones de creación en contexto de A siempre inyectan tenantId=A en data", async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantPairArb,
        directModelArb,
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }),
          email: fc.emailAddress(),
        }),
        async ([tenantA, tenantB], model, extraData) => {
          const result = await runMiddleware(tenantA, model, "create", {
            data: { ...extraData },
          });

          // El data debe contener tenantId del tenant A
          const data = result.args.data as Record<string, unknown>;
          expect(data).toBeDefined();
          expect(data.tenantId).toBe(tenantA);

          // El data nunca debe contener el tenantId del tenant B
          expect(data.tenantId).not.toBe(tenantB);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("el middleware nunca inyecta un tenantId diferente al del contexto activo para operaciones de escritura", async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantPairArb,
        directModelArb,
        writeActionArb,
        async ([tenantA, tenantB], model, action) => {
          const result = await runMiddleware(tenantA, model, action);

          // El WHERE debe contener tenantId del tenant A
          const where = result.args.where as Record<string, unknown>;
          expect(where).toBeDefined();
          expect(where.tenantId).toBe(tenantA);

          // Nunca debe ser el tenant B
          expect(where.tenantId).not.toBe(tenantB);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("modelos con relación indirecta filtran por tenantId del contexto activo a través de la relación", async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantPairArb,
        relationModelArb,
        readActionArb,
        async ([tenantA, tenantB], model, action) => {
          const result = await runMiddleware(tenantA, model, action);

          const where = result.args.where as Record<string, unknown>;
          expect(where).toBeDefined();

          // Debe filtrar por la relación correspondiente
          const relationField = RELATION_TENANT_MODELS[model];
          const relation = where[relationField] as Record<string, unknown>;
          expect(relation).toBeDefined();
          expect(relation.tenantId).toBe(tenantA);

          // Nunca debe ser el tenant B
          expect(relation.tenantId).not.toBe(tenantB);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("createMany inyecta tenantId=A en todos los registros del batch", async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantPairArb,
        directModelArb,
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 30 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async ([tenantA, tenantB], model, items) => {
          const result = await runMiddleware(tenantA, model, "createMany", {
            data: items,
          });

          const data = result.args.data as Array<Record<string, unknown>>;
          expect(data).toBeDefined();
          expect(Array.isArray(data)).toBe(true);

          // Todos los registros deben tener tenantId=A
          for (const item of data) {
            expect(item.tenantId).toBe(tenantA);
            expect(item.tenantId).not.toBe(tenantB);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("sin contexto de tenant, el middleware no inyecta ningún filtro (operaciones de sistema)", async () => {
    await fc.assert(
      fc.asyncProperty(
        allTenantModelArb,
        readActionArb,
        async (model, action) => {
          // Sin tenant en contexto
          const result = await runMiddleware(undefined, model, action);

          // Sin tenant, no debe haber filtro de tenantId inyectado
          const where = result.args.where as
            | Record<string, unknown>
            | undefined;
          if (where) {
            expect(where.tenantId).toBeUndefined();
            // Tampoco debe haber filtros en relaciones
            for (const relField of Object.values(RELATION_TENANT_MODELS)) {
              const rel = where[relField] as
                | Record<string, unknown>
                | undefined;
              if (rel) {
                expect(rel.tenantId).toBeUndefined();
              }
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});

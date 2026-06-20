/**
 * Prisma Middleware — Inyección automática de tenantId
 *
 * Intercepta todas las operaciones de Prisma para:
 * 1. Inyectar filtro `tenantId` en WHERE para operaciones de lectura
 * 2. Agregar `tenantId` a data para operaciones de creación
 * 3. Inyectar filtro `tenantId` en WHERE para update/delete
 *
 * Esto garantiza aislamiento de datos a nivel de aplicación (Requisito 8.2).
 * PostgreSQL RLS actúa como segunda capa de defensa.
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { getCurrentTenantId } from "./tenant-context";

/**
 * Modelos que tienen campo `tenantId` directo.
 * Estos modelos se filtran directamente por tenantId.
 */
const TENANT_MODELS: ReadonlySet<string> = new Set([
  "Tenant",
  "TenantUser",
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
]);

/**
 * Modelos que no tienen tenantId directo pero pertenecen a un tenant
 * a través de relaciones. Estos se filtran por relación.
 */
const TENANT_RELATION_MODELS: Readonly<Record<string, string>> = {
  Message: "conversation",
  ScoreHistory: "lead",
  FollowUpStep: "sequence",
  FollowUpExecution: "sequence",
};

/**
 * Operaciones de lectura que requieren filtro WHERE.
 */
const READ_ACTIONS: ReadonlySet<string> = new Set([
  "findMany",
  "findFirst",
  "findUnique",
  "findFirstOrThrow",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);

/**
 * Operaciones de escritura que requieren filtro WHERE.
 */
const WRITE_ACTIONS: ReadonlySet<string> = new Set([
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "upsert",
]);

/**
 * Operaciones de creación que requieren inyección en data.
 */
const CREATE_ACTIONS: ReadonlySet<string> = new Set([
  "create",
  "createMany",
]);

/**
 * Determina si un modelo debe ser filtrado por tenant.
 * El modelo "Tenant" se filtra por `id` en lugar de `tenantId`.
 */
function isTenantModel(model: string | undefined): boolean {
  if (!model) return false;
  return TENANT_MODELS.has(model) || model in TENANT_RELATION_MODELS;
}

/**
 * Inyecta el filtro de tenantId en los argumentos WHERE de una operación.
 */
function injectWhereFilter(
  args: Record<string, unknown>,
  model: string,
  tenantId: string
): void {
  if (!args.where) {
    args.where = {};
  }

  const where = args.where as Record<string, unknown>;

  if (model === "Tenant") {
    // Para el modelo Tenant, filtrar por id
    where.id = tenantId;
  } else if (TENANT_MODELS.has(model)) {
    // Modelos con tenantId directo
    where.tenantId = tenantId;
  } else if (model in TENANT_RELATION_MODELS) {
    // Modelos sin tenantId directo: filtrar por relación
    const relationField = TENANT_RELATION_MODELS[model];
    if (!where[relationField]) {
      where[relationField] = {};
    }
    const relation = where[relationField] as Record<string, unknown>;
    relation.tenantId = tenantId;
  }
}

/**
 * Inyecta el tenantId en los datos de creación.
 */
function injectCreateData(
  args: Record<string, unknown>,
  model: string,
  tenantId: string
): void {
  if (model === "Tenant") {
    // No inyectar tenantId en el modelo Tenant (usa id)
    return;
  }

  if (!TENANT_MODELS.has(model)) {
    // Modelos sin tenantId directo no necesitan inyección en create
    return;
  }

  if (args.data && typeof args.data === "object") {
    const data = args.data as Record<string, unknown>;
    // Solo inyectar si no se proporcionó explícitamente
    if (!data.tenantId) {
      data.tenantId = tenantId;
    }
  }
}

/**
 * Inyecta tenantId en operaciones createMany.
 */
function injectCreateManyData(
  args: Record<string, unknown>,
  model: string,
  tenantId: string
): void {
  if (model === "Tenant" || !TENANT_MODELS.has(model)) {
    return;
  }

  if (args.data && Array.isArray(args.data)) {
    args.data = (args.data as Record<string, unknown>[]).map((item) => ({
      ...item,
      tenantId: item.tenantId || tenantId,
    }));
  }
}

/**
 * Registra el middleware de aislamiento de tenant en el cliente Prisma.
 *
 * @example
 * ```ts
 * import { PrismaClient } from '@prisma/client';
 * import { registerTenantMiddleware } from './prisma-middleware';
 *
 * const prisma = new PrismaClient();
 * registerTenantMiddleware(prisma);
 * ```
 */
export function registerTenantMiddleware(prisma: PrismaClient): void {
  prisma.$use(async (params: Prisma.MiddlewareParams, next) => {
    const tenantId = getCurrentTenantId();

    // Si no hay tenant en el contexto, dejar pasar sin filtro
    // (útil para operaciones de sistema como crear un nuevo tenant)
    if (!tenantId) {
      return next(params);
    }

    const model = params.model;
    const action = params.action;

    // Solo procesar modelos que pertenecen a un tenant
    if (!isTenantModel(model)) {
      return next(params);
    }

    // Asegurar que args existe
    if (!params.args) {
      params.args = {};
    }

    // Operaciones de lectura: inyectar filtro WHERE
    if (READ_ACTIONS.has(action)) {
      injectWhereFilter(params.args, model!, tenantId);
    }

    // Operaciones de escritura (update/delete): inyectar filtro WHERE
    if (WRITE_ACTIONS.has(action)) {
      injectWhereFilter(params.args, model!, tenantId);

      // Para upsert, también inyectar en create data
      if (action === "upsert" && params.args.create) {
        const createData = params.args.create as Record<string, unknown>;
        if (TENANT_MODELS.has(model!) && model !== "Tenant") {
          if (!createData.tenantId) {
            createData.tenantId = tenantId;
          }
        }
      }
    }

    // Operaciones de creación: inyectar tenantId en data
    if (CREATE_ACTIONS.has(action)) {
      if (action === "createMany") {
        injectCreateManyData(params.args, model!, tenantId);
      } else {
        injectCreateData(params.args, model!, tenantId);
      }
    }

    return next(params);
  });
}

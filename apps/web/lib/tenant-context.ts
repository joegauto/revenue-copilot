/**
 * Tenant Context — AsyncLocalStorage para aislamiento multi-tenant
 *
 * Almacena el tenantId actual por request usando AsyncLocalStorage de Node.js.
 * Esto permite que el Prisma middleware acceda al tenantId sin pasarlo
 * explícitamente a través de toda la cadena de llamadas.
 *
 * Requisito 8.2: Impedir que un Tenant acceda a datos de otro Tenant.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantStore {
  tenantId: string;
}

/**
 * AsyncLocalStorage global para el contexto del tenant.
 * Cada request HTTP corre en su propio contexto aislado.
 */
const tenantStorage = new AsyncLocalStorage<TenantStore>();

/**
 * Ejecuta una función dentro del contexto de un tenant específico.
 * Todas las operaciones de Prisma dentro del callback heredarán el tenantId.
 *
 * @example
 * ```ts
 * await runWithTenant(tenantId, async () => {
 *   const leads = await prisma.lead.findMany(); // filtrado automáticamente
 * });
 * ```
 */
export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return tenantStorage.run({ tenantId }, fn);
}

/**
 * Obtiene el tenantId del contexto actual.
 * Retorna undefined si no hay contexto de tenant activo.
 */
export function getCurrentTenantId(): string | undefined {
  return tenantStorage.getStore()?.tenantId;
}

/**
 * Obtiene el tenantId del contexto actual o lanza un error.
 * Usar en operaciones que requieren obligatoriamente un tenant.
 *
 * @throws Error si no hay tenant en el contexto
 */
export function requireTenantId(): string {
  const tenantId = getCurrentTenantId();
  if (!tenantId) {
    throw new Error(
      "No tenant context found. Ensure the request is wrapped with runWithTenant()."
    );
  }
  return tenantId;
}

export { tenantStorage };

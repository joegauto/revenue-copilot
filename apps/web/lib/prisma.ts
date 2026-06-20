/**
 * Prisma Client Singleton — Instancia compartida con middleware de tenant
 *
 * Exporta una instancia única de PrismaClient con el middleware de
 * aislamiento multi-tenant registrado. Usar esta instancia en toda la app.
 */

import { PrismaClient } from "@prisma/client";
import { registerTenantMiddleware } from "./prisma-middleware";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  (() => {
    const client = new PrismaClient();
    registerTenantMiddleware(client);
    return client;
  })();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;

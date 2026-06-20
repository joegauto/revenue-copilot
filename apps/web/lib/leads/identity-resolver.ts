/**
 * Identity Resolver — Resolución de identidad de leads
 *
 * Identifica si un lead ya existe en el sistema buscando por:
 * 1. Teléfono
 * 2. Email
 * 3. Session ID web
 *
 * Si coincide con un lead existente del mismo tenant → vincula al lead existente.
 * Si no coincide → crea un nuevo lead con score inicial 0.
 *
 * Requisitos: 1.7, 2.1
 */

import { Lead, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../prisma";

export interface ResolveLeadIdentityParams {
  tenantId: string;
  phone?: string;
  email?: string;
  webSessionId?: string;
  channel: string;
}

export interface ResolveLeadIdentityResult {
  lead: Lead;
  isNew: boolean;
}

/**
 * Resuelve la identidad de un lead buscando por teléfono, email o webSessionId.
 *
 * Orden de búsqueda: phone → email → webSessionId
 * - Si se encuentra un lead existente del mismo tenant, se retorna con isNew: false
 * - Si no se encuentra, se crea un nuevo lead con score 0 y status "new"
 *
 * @param params - Parámetros de identificación del lead
 * @param prismaClient - Cliente Prisma (inyectable para testing)
 * @returns Lead encontrado o creado, con indicador de si es nuevo
 */
export async function resolveLeadIdentity(
  params: ResolveLeadIdentityParams,
  prismaClient: PrismaClient = defaultPrisma
): Promise<ResolveLeadIdentityResult> {
  const { tenantId, phone, email, webSessionId, channel } = params;

  // Buscar por teléfono (prioridad más alta)
  if (phone) {
    const existingByPhone = await prismaClient.lead.findFirst({
      where: { tenantId, phone },
    });
    if (existingByPhone) {
      return { lead: existingByPhone, isNew: false };
    }
  }

  // Buscar por email
  if (email) {
    const existingByEmail = await prismaClient.lead.findFirst({
      where: { tenantId, email },
    });
    if (existingByEmail) {
      return { lead: existingByEmail, isNew: false };
    }
  }

  // Buscar por webSessionId
  if (webSessionId) {
    const existingBySession = await prismaClient.lead.findFirst({
      where: { tenantId, webSessionId },
    });
    if (existingBySession) {
      return { lead: existingBySession, isNew: false };
    }
  }

  // No se encontró lead existente → crear nuevo
  const newLead = await prismaClient.lead.create({
    data: {
      tenantId,
      phone: phone || null,
      email: email || null,
      webSessionId: webSessionId || null,
      score: 0,
      status: "new",
      preferredChannel: channel,
    },
  });

  return { lead: newLead, isNew: true };
}

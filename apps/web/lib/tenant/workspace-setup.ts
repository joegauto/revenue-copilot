/**
 * Workspace Setup — Configuración por defecto para nuevo Tenant
 *
 * Al registrar un nuevo tenant, crea toda la configuración inicial:
 * - ScoringConfig con pesos predeterminados (40/25/20/15), umbral 60
 * - ConversationTemplate para "servicios_profesionales"
 * - NO crea FollowUpSequences (inician desactivadas)
 * - NO crea WhatsAppConfig ni CalendarConfig (vienen del onboarding)
 *
 * Requisitos: 8.3, 8.4
 */

import { PrismaClient } from "@prisma/client";

/**
 * Plantilla de flujo conversacional por defecto para servicios profesionales.
 * Define la estructura de conversación que el agente IA seguirá.
 */
const DEFAULT_FLOW_CONFIG = {
  industry: "servicios_profesionales",
  greeting:
    "¡Hola! Soy el asistente comercial. ¿En qué puedo ayudarte hoy?",
  qualificationFlow: [
    "¿Qué tipo de servicio estás buscando?",
    "¿Cuál es el tamaño de tu empresa o equipo?",
    "¿Cuál es tu presupuesto aproximado?",
    "¿En qué plazo necesitas el servicio?",
  ],
  objectionHandling: {
    precio: "Entiendo tu preocupación por el presupuesto. Permíteme mostrarte las opciones que se ajustan a tus necesidades.",
    urgencia: "Comprendo que no es urgente ahora. ¿Te gustaría que te contacte en un momento más oportuno?",
    confianza: "Es normal querer estar seguro. Te comparto algunos casos de éxito de clientes similares.",
    necesidad: "Entiendo. Permíteme explicarte cómo este servicio puede beneficiar a tu negocio.",
  },
  conversionAction: "schedule",
  maxResponseWords: 300,
};

export interface WorkspaceSetupResult {
  scoringConfigId: string;
  conversationTemplateId: string;
}

/**
 * Crea la configuración por defecto del workspace para un nuevo tenant.
 *
 * Incluye:
 * - ScoringConfig: pesos 40/25/20/15, umbral 60, preguntas vacías, perfil vacío
 * - ConversationTemplate: plantilla para "servicios_profesionales"
 *
 * No incluye (se configuran en onboarding):
 * - FollowUpSequences (desactivadas por defecto)
 * - WhatsAppConfig
 * - CalendarConfig
 *
 * @param tenantId - UUID del tenant recién creado
 * @param db - Instancia de PrismaClient (inyectable para testing)
 * @returns IDs de los recursos creados
 */
export async function createDefaultWorkspace(
  tenantId: string,
  db: PrismaClient
): Promise<WorkspaceSetupResult> {
  // Crear ScoringConfig con valores predeterminados
  const scoringConfig = await db.scoringConfig.create({
    data: {
      tenantId,
      weightQualification: 40,
      weightEngagement: 25,
      weightDemographics: 20,
      weightResponseSpeed: 15,
      qualificationThreshold: 60,
      qualificationQuestions: [],
      targetProfile: {},
    },
  });

  // Crear plantilla de conversación por defecto para servicios profesionales
  const conversationTemplate = await db.conversationTemplate.create({
    data: {
      tenantId,
      name: "Servicios Profesionales - Plantilla Base",
      industry: "servicios_profesionales",
      flowConfig: DEFAULT_FLOW_CONFIG,
      isDefault: true,
    },
  });

  return {
    scoringConfigId: scoringConfig.id,
    conversationTemplateId: conversationTemplate.id,
  };
}

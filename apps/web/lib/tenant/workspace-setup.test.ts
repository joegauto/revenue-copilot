/**
 * Tests para workspace-setup — Creación de configuración por defecto de tenant
 *
 * Valida: Requisitos 8.3, 8.4
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDefaultWorkspace } from "./workspace-setup";

/**
 * Mock de PrismaClient que captura las llamadas a create
 * para verificar los datos enviados sin conexión a DB.
 */
function createMockPrisma() {
  const scoringConfigCreate = vi.fn().mockResolvedValue({
    id: "scoring-config-id-123",
    tenantId: "tenant-id-abc",
    weightQualification: 40,
    weightEngagement: 25,
    weightDemographics: 20,
    weightResponseSpeed: 15,
    qualificationThreshold: 60,
    qualificationQuestions: [],
    targetProfile: {},
  });

  const conversationTemplateCreate = vi.fn().mockResolvedValue({
    id: "template-id-456",
    tenantId: "tenant-id-abc",
    name: "Servicios Profesionales - Plantilla Base",
    industry: "servicios_profesionales",
    flowConfig: {},
    isDefault: true,
  });

  return {
    scoringConfig: { create: scoringConfigCreate },
    conversationTemplate: { create: conversationTemplateCreate },
    _mocks: { scoringConfigCreate, conversationTemplateCreate },
  };
}

describe("createDefaultWorkspace", () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
  });

  it("crea ScoringConfig con pesos predeterminados (40/25/20/15)", async () => {
    const tenantId = "tenant-id-abc";

    await createDefaultWorkspace(tenantId, mockPrisma as never);

    expect(mockPrisma._mocks.scoringConfigCreate).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-id-abc",
        weightQualification: 40,
        weightEngagement: 25,
        weightDemographics: 20,
        weightResponseSpeed: 15,
        qualificationThreshold: 60,
        qualificationQuestions: [],
        targetProfile: {},
      },
    });
  });

  it("crea ScoringConfig con umbral de calificación 60", async () => {
    const tenantId = "tenant-id-abc";

    await createDefaultWorkspace(tenantId, mockPrisma as never);

    const callArgs = mockPrisma._mocks.scoringConfigCreate.mock.calls[0][0];
    expect(callArgs.data.qualificationThreshold).toBe(60);
  });

  it("crea ScoringConfig con preguntas de calificación vacías", async () => {
    const tenantId = "tenant-id-abc";

    await createDefaultWorkspace(tenantId, mockPrisma as never);

    const callArgs = mockPrisma._mocks.scoringConfigCreate.mock.calls[0][0];
    expect(callArgs.data.qualificationQuestions).toEqual([]);
  });

  it("crea ScoringConfig con perfil objetivo vacío", async () => {
    const tenantId = "tenant-id-abc";

    await createDefaultWorkspace(tenantId, mockPrisma as never);

    const callArgs = mockPrisma._mocks.scoringConfigCreate.mock.calls[0][0];
    expect(callArgs.data.targetProfile).toEqual({});
  });

  it("crea ConversationTemplate para industria servicios_profesionales", async () => {
    const tenantId = "tenant-id-abc";

    await createDefaultWorkspace(tenantId, mockPrisma as never);

    const callArgs =
      mockPrisma._mocks.conversationTemplateCreate.mock.calls[0][0];
    expect(callArgs.data.industry).toBe("servicios_profesionales");
    expect(callArgs.data.tenantId).toBe("tenant-id-abc");
  });

  it("marca la plantilla como default (isDefault: true)", async () => {
    const tenantId = "tenant-id-abc";

    await createDefaultWorkspace(tenantId, mockPrisma as never);

    const callArgs =
      mockPrisma._mocks.conversationTemplateCreate.mock.calls[0][0];
    expect(callArgs.data.isDefault).toBe(true);
  });

  it("incluye flowConfig con estructura de conversación", async () => {
    const tenantId = "tenant-id-abc";

    await createDefaultWorkspace(tenantId, mockPrisma as never);

    const callArgs =
      mockPrisma._mocks.conversationTemplateCreate.mock.calls[0][0];
    const flowConfig = callArgs.data.flowConfig;

    expect(flowConfig).toHaveProperty("industry", "servicios_profesionales");
    expect(flowConfig).toHaveProperty("greeting");
    expect(flowConfig).toHaveProperty("qualificationFlow");
    expect(flowConfig).toHaveProperty("objectionHandling");
    expect(flowConfig.qualificationFlow).toBeInstanceOf(Array);
    expect(flowConfig.qualificationFlow.length).toBeGreaterThan(0);
  });

  it("retorna los IDs de los recursos creados", async () => {
    const tenantId = "tenant-id-abc";

    const result = await createDefaultWorkspace(tenantId, mockPrisma as never);

    expect(result).toEqual({
      scoringConfigId: "scoring-config-id-123",
      conversationTemplateId: "template-id-456",
    });
  });

  it("NO crea FollowUpSequences (secuencias desactivadas por defecto)", async () => {
    const tenantId = "tenant-id-abc";

    await createDefaultWorkspace(tenantId, mockPrisma as never);

    // Solo se deben haber llamado scoringConfig.create y conversationTemplate.create
    expect(mockPrisma._mocks.scoringConfigCreate).toHaveBeenCalledTimes(1);
    expect(
      mockPrisma._mocks.conversationTemplateCreate
    ).toHaveBeenCalledTimes(1);
  });

  it("los pesos del scoring suman exactamente 100", async () => {
    const tenantId = "tenant-id-abc";

    await createDefaultWorkspace(tenantId, mockPrisma as never);

    const callArgs = mockPrisma._mocks.scoringConfigCreate.mock.calls[0][0];
    const totalWeight =
      callArgs.data.weightQualification +
      callArgs.data.weightEngagement +
      callArgs.data.weightDemographics +
      callArgs.data.weightResponseSpeed;

    expect(totalWeight).toBe(100);
  });

  it("propaga errores de base de datos correctamente", async () => {
    const tenantId = "tenant-id-abc";
    const dbError = new Error("Database connection failed");
    mockPrisma._mocks.scoringConfigCreate.mockRejectedValueOnce(dbError);

    await expect(
      createDefaultWorkspace(tenantId, mockPrisma as never)
    ).rejects.toThrow("Database connection failed");
  });

  it("usa el tenantId proporcionado en ambas creaciones", async () => {
    const tenantId = "unique-tenant-xyz";

    await createDefaultWorkspace(tenantId, mockPrisma as never);

    const scoringArgs =
      mockPrisma._mocks.scoringConfigCreate.mock.calls[0][0];
    const templateArgs =
      mockPrisma._mocks.conversationTemplateCreate.mock.calls[0][0];

    expect(scoringArgs.data.tenantId).toBe("unique-tenant-xyz");
    expect(templateArgs.data.tenantId).toBe("unique-tenant-xyz");
  });
});

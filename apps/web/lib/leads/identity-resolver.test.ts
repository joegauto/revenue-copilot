import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock del módulo prisma para evitar inicialización de PrismaClient
vi.mock("../prisma", () => ({
  prisma: {},
  default: {},
}));

import { resolveLeadIdentity } from "./identity-resolver";

/**
 * Tests para resolución de identidad de leads.
 *
 * Valida: Requisitos 1.7, 2.1
 * - Identificación por teléfono, email o session ID web
 * - Vinculación a lead existente del mismo tenant
 * - Creación de nuevo lead con score 0 si no coincide
 */

// Mock del Lead para reutilizar en tests
const mockExistingLead = {
  id: "lead-existing-123",
  tenantId: "tenant-abc",
  name: "Juan Pérez",
  email: "juan@example.com",
  phone: "+34600111222",
  webSessionId: "session-xyz",
  score: 45,
  status: "contacted",
  segment: null,
  preferredChannel: "whatsapp",
  avgResponseMinutes: null,
  totalMessages: 5,
  qualificationAnswers: 2,
  totalQualificationQs: 5,
  demographicMatch: false,
  lastMessageAt: new Date("2024-01-15"),
  qualifiedAt: null,
  convertedAt: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-15"),
};

const mockNewLead = {
  id: "lead-new-456",
  tenantId: "tenant-abc",
  name: null,
  email: null,
  phone: "+34600999888",
  webSessionId: null,
  score: 0,
  status: "new",
  segment: null,
  preferredChannel: "whatsapp",
  avgResponseMinutes: null,
  totalMessages: 0,
  qualificationAnswers: 0,
  totalQualificationQs: 0,
  demographicMatch: false,
  lastMessageAt: null,
  qualifiedAt: null,
  convertedAt: null,
  createdAt: new Date("2024-01-20"),
  updatedAt: new Date("2024-01-20"),
};

function createMockPrisma() {
  return {
    lead: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  } as unknown as Parameters<typeof resolveLeadIdentity>[1];
}

describe("identity-resolver", () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    vi.clearAllMocks();
  });

  describe("búsqueda por teléfono (prioridad más alta)", () => {
    it("retorna lead existente cuando coincide por teléfono", async () => {
      const findFirst = vi.mocked(
        (mockPrisma as any).lead.findFirst
      );
      findFirst.mockResolvedValueOnce(mockExistingLead);

      const result = await resolveLeadIdentity(
        {
          tenantId: "tenant-abc",
          phone: "+34600111222",
          email: "otro@example.com",
          channel: "whatsapp",
        },
        mockPrisma
      );

      expect(result.lead).toEqual(mockExistingLead);
      expect(result.isNew).toBe(false);
      expect(findFirst).toHaveBeenCalledWith({
        where: { tenantId: "tenant-abc", phone: "+34600111222" },
      });
      // No debería buscar por email si ya encontró por teléfono
      expect(findFirst).toHaveBeenCalledTimes(1);
    });

    it("busca por teléfono antes que por email o webSessionId", async () => {
      const findFirst = vi.mocked(
        (mockPrisma as any).lead.findFirst
      );
      findFirst.mockResolvedValueOnce(mockExistingLead);

      await resolveLeadIdentity(
        {
          tenantId: "tenant-abc",
          phone: "+34600111222",
          email: "juan@example.com",
          webSessionId: "session-xyz",
          channel: "whatsapp",
        },
        mockPrisma
      );

      // Solo una llamada porque encontró por teléfono
      expect(findFirst).toHaveBeenCalledTimes(1);
      expect(findFirst).toHaveBeenCalledWith({
        where: { tenantId: "tenant-abc", phone: "+34600111222" },
      });
    });
  });

  describe("búsqueda por email (segunda prioridad)", () => {
    it("retorna lead existente cuando coincide por email", async () => {
      const findFirst = vi.mocked(
        (mockPrisma as any).lead.findFirst
      );
      // No encontrado por teléfono
      findFirst.mockResolvedValueOnce(null);
      // Encontrado por email
      findFirst.mockResolvedValueOnce(mockExistingLead);

      const result = await resolveLeadIdentity(
        {
          tenantId: "tenant-abc",
          phone: "+34600000000",
          email: "juan@example.com",
          channel: "webchat",
        },
        mockPrisma
      );

      expect(result.lead).toEqual(mockExistingLead);
      expect(result.isNew).toBe(false);
      expect(findFirst).toHaveBeenCalledTimes(2);
      expect(findFirst).toHaveBeenNthCalledWith(2, {
        where: { tenantId: "tenant-abc", email: "juan@example.com" },
      });
    });

    it("busca por email si no se proporciona teléfono", async () => {
      const findFirst = vi.mocked(
        (mockPrisma as any).lead.findFirst
      );
      findFirst.mockResolvedValueOnce(mockExistingLead);

      const result = await resolveLeadIdentity(
        {
          tenantId: "tenant-abc",
          email: "juan@example.com",
          channel: "webchat",
        },
        mockPrisma
      );

      expect(result.lead).toEqual(mockExistingLead);
      expect(result.isNew).toBe(false);
      expect(findFirst).toHaveBeenCalledTimes(1);
      expect(findFirst).toHaveBeenCalledWith({
        where: { tenantId: "tenant-abc", email: "juan@example.com" },
      });
    });
  });

  describe("búsqueda por webSessionId (tercera prioridad)", () => {
    it("retorna lead existente cuando coincide por webSessionId", async () => {
      const findFirst = vi.mocked(
        (mockPrisma as any).lead.findFirst
      );
      // No encontrado por teléfono ni email
      findFirst.mockResolvedValueOnce(null);
      findFirst.mockResolvedValueOnce(null);
      // Encontrado por webSessionId
      findFirst.mockResolvedValueOnce(mockExistingLead);

      const result = await resolveLeadIdentity(
        {
          tenantId: "tenant-abc",
          phone: "+34600000000",
          email: "desconocido@example.com",
          webSessionId: "session-xyz",
          channel: "webchat",
        },
        mockPrisma
      );

      expect(result.lead).toEqual(mockExistingLead);
      expect(result.isNew).toBe(false);
      expect(findFirst).toHaveBeenCalledTimes(3);
      expect(findFirst).toHaveBeenNthCalledWith(3, {
        where: { tenantId: "tenant-abc", webSessionId: "session-xyz" },
      });
    });

    it("busca por webSessionId si no se proporcionan teléfono ni email", async () => {
      const findFirst = vi.mocked(
        (mockPrisma as any).lead.findFirst
      );
      findFirst.mockResolvedValueOnce(mockExistingLead);

      const result = await resolveLeadIdentity(
        {
          tenantId: "tenant-abc",
          webSessionId: "session-xyz",
          channel: "webchat",
        },
        mockPrisma
      );

      expect(result.lead).toEqual(mockExistingLead);
      expect(result.isNew).toBe(false);
      expect(findFirst).toHaveBeenCalledTimes(1);
      expect(findFirst).toHaveBeenCalledWith({
        where: { tenantId: "tenant-abc", webSessionId: "session-xyz" },
      });
    });
  });

  describe("creación de nuevo lead", () => {
    it("crea nuevo lead con score 0 y status 'new' si no coincide ningún identificador", async () => {
      const findFirst = vi.mocked(
        (mockPrisma as any).lead.findFirst
      );
      const create = vi.mocked((mockPrisma as any).lead.create);

      findFirst.mockResolvedValue(null);
      create.mockResolvedValueOnce(mockNewLead);

      const result = await resolveLeadIdentity(
        {
          tenantId: "tenant-abc",
          phone: "+34600999888",
          channel: "whatsapp",
        },
        mockPrisma
      );

      expect(result.lead).toEqual(mockNewLead);
      expect(result.isNew).toBe(true);
      expect(create).toHaveBeenCalledWith({
        data: {
          tenantId: "tenant-abc",
          phone: "+34600999888",
          email: null,
          webSessionId: null,
          score: 0,
          status: "new",
          preferredChannel: "whatsapp",
        },
      });
    });

    it("crea nuevo lead con todos los identificadores proporcionados", async () => {
      const findFirst = vi.mocked(
        (mockPrisma as any).lead.findFirst
      );
      const create = vi.mocked((mockPrisma as any).lead.create);

      findFirst.mockResolvedValue(null);
      create.mockResolvedValueOnce({
        ...mockNewLead,
        email: "nuevo@example.com",
        webSessionId: "session-new",
      });

      const result = await resolveLeadIdentity(
        {
          tenantId: "tenant-abc",
          phone: "+34600999888",
          email: "nuevo@example.com",
          webSessionId: "session-new",
          channel: "webchat",
        },
        mockPrisma
      );

      expect(result.isNew).toBe(true);
      expect(create).toHaveBeenCalledWith({
        data: {
          tenantId: "tenant-abc",
          phone: "+34600999888",
          email: "nuevo@example.com",
          webSessionId: "session-new",
          score: 0,
          status: "new",
          preferredChannel: "webchat",
        },
      });
    });

    it("crea nuevo lead sin identificadores opcionales", async () => {
      const findFirst = vi.mocked(
        (mockPrisma as any).lead.findFirst
      );
      const create = vi.mocked((mockPrisma as any).lead.create);

      findFirst.mockResolvedValue(null);
      create.mockResolvedValueOnce({
        ...mockNewLead,
        phone: null,
        webSessionId: "session-only",
        preferredChannel: "webchat",
      });

      const result = await resolveLeadIdentity(
        {
          tenantId: "tenant-abc",
          webSessionId: "session-only",
          channel: "webchat",
        },
        mockPrisma
      );

      expect(result.isNew).toBe(true);
      expect(create).toHaveBeenCalledWith({
        data: {
          tenantId: "tenant-abc",
          phone: null,
          email: null,
          webSessionId: "session-only",
          score: 0,
          status: "new",
          preferredChannel: "webchat",
        },
      });
    });
  });

  describe("aislamiento por tenant", () => {
    it("siempre filtra por tenantId en las búsquedas", async () => {
      const findFirst = vi.mocked(
        (mockPrisma as any).lead.findFirst
      );
      findFirst.mockResolvedValue(null);
      const create = vi.mocked((mockPrisma as any).lead.create);
      create.mockResolvedValueOnce(mockNewLead);

      await resolveLeadIdentity(
        {
          tenantId: "tenant-specific",
          phone: "+34600111222",
          email: "test@example.com",
          webSessionId: "session-1",
          channel: "whatsapp",
        },
        mockPrisma
      );

      // Verificar que todas las búsquedas incluyen tenantId
      expect(findFirst).toHaveBeenNthCalledWith(1, {
        where: { tenantId: "tenant-specific", phone: "+34600111222" },
      });
      expect(findFirst).toHaveBeenNthCalledWith(2, {
        where: { tenantId: "tenant-specific", email: "test@example.com" },
      });
      expect(findFirst).toHaveBeenNthCalledWith(3, {
        where: { tenantId: "tenant-specific", webSessionId: "session-1" },
      });
    });

    it("no retorna lead de otro tenant aunque coincida el teléfono", async () => {
      const findFirst = vi.mocked(
        (mockPrisma as any).lead.findFirst
      );
      const create = vi.mocked((mockPrisma as any).lead.create);

      // Simular que no se encuentra (porque el filtro por tenantId excluye al lead de otro tenant)
      findFirst.mockResolvedValue(null);
      create.mockResolvedValueOnce({
        ...mockNewLead,
        tenantId: "tenant-different",
      });

      const result = await resolveLeadIdentity(
        {
          tenantId: "tenant-different",
          phone: "+34600111222",
          channel: "whatsapp",
        },
        mockPrisma
      );

      expect(result.isNew).toBe(true);
      expect(findFirst).toHaveBeenCalledWith({
        where: { tenantId: "tenant-different", phone: "+34600111222" },
      });
    });
  });
});

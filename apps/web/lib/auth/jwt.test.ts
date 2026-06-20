import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateToken, verifyToken } from "./jwt";

describe("JWT Module", () => {
  const originalEnv = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret-key-that-is-at-least-32-chars-long";
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.JWT_SECRET = originalEnv;
    } else {
      delete process.env.JWT_SECRET;
    }
  });

  describe("generateToken", () => {
    it("genera un token JWT válido", async () => {
      const payload = {
        tenantId: "tenant-123",
        userId: "user-456",
        email: "test@example.com",
      };

      const token = await generateToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      // JWT tiene 3 partes separadas por puntos
      expect(token.split(".")).toHaveLength(3);
    });

    it("genera tokens diferentes para el mismo payload (por iat)", async () => {
      const payload = {
        tenantId: "tenant-123",
        userId: "user-456",
        email: "test@example.com",
      };

      const token1 = await generateToken(payload);
      // Avanzar el reloj ligeramente para obtener un iat diferente
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const token2 = await generateToken(payload);

      expect(token1).not.toBe(token2);
    });

    it("lanza error si JWT_SECRET no está configurado", async () => {
      delete process.env.JWT_SECRET;

      const payload = {
        tenantId: "tenant-123",
        userId: "user-456",
        email: "test@example.com",
      };

      await expect(generateToken(payload)).rejects.toThrow(
        "JWT_SECRET environment variable is not set"
      );
    });
  });

  describe("verifyToken", () => {
    it("verifica y decodifica un token válido", async () => {
      const payload = {
        tenantId: "tenant-abc",
        userId: "user-xyz",
        email: "admin@empresa.com",
      };

      const token = await generateToken(payload);
      const decoded = await verifyToken(token);

      expect(decoded.tenantId).toBe("tenant-abc");
      expect(decoded.userId).toBe("user-xyz");
      expect(decoded.email).toBe("admin@empresa.com");
    });

    it("incluye campos iat y exp en el payload decodificado", async () => {
      const payload = {
        tenantId: "tenant-1",
        userId: "user-1",
        email: "user@test.com",
      };

      const token = await generateToken(payload);
      const decoded = await verifyToken(token);

      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      // exp debe ser ~24h después de iat
      const diffSeconds = decoded.exp! - decoded.iat!;
      expect(diffSeconds).toBe(86400); // 24h en segundos
    });

    it("rechaza un token con firma inválida", async () => {
      const payload = {
        tenantId: "tenant-1",
        userId: "user-1",
        email: "user@test.com",
      };

      const token = await generateToken(payload);
      // Modificar la firma (última parte del token)
      const parts = token.split(".");
      parts[2] = parts[2] + "tampered";
      const tamperedToken = parts.join(".");

      await expect(verifyToken(tamperedToken)).rejects.toThrow();
    });

    it("rechaza un token completamente inválido", async () => {
      await expect(verifyToken("not-a-valid-token")).rejects.toThrow();
    });

    it("rechaza un token vacío", async () => {
      await expect(verifyToken("")).rejects.toThrow();
    });

    it("lanza error si JWT_SECRET no está configurado", async () => {
      delete process.env.JWT_SECRET;

      await expect(verifyToken("some.token.here")).rejects.toThrow(
        "JWT_SECRET environment variable is not set"
      );
    });

    it("rechaza un token firmado con un secret diferente", async () => {
      const payload = {
        tenantId: "tenant-1",
        userId: "user-1",
        email: "user@test.com",
      };

      // Generar token con el secret actual
      const token = await generateToken(payload);

      // Cambiar el secret
      process.env.JWT_SECRET =
        "different-secret-key-that-is-also-at-least-32-chars";

      // Verificar con el nuevo secret debe fallar
      await expect(verifyToken(token)).rejects.toThrow();
    });
  });
});

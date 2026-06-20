import { describe, it, expect } from "vitest";
import { validatePassword } from "./password-validator";

describe("validatePassword", () => {
  describe("contraseñas válidas", () => {
    it("acepta una contraseña que cumple todos los criterios", () => {
      const result = validatePassword("Abcdef1!");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("acepta una contraseña de exactamente 8 caracteres", () => {
      const result = validatePassword("Aa1!xxxx");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("acepta una contraseña de exactamente 128 caracteres", () => {
      const password = "Aa1!" + "x".repeat(124);
      expect(password.length).toBe(128);
      const result = validatePassword(password);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("acepta contraseñas con múltiples caracteres especiales", () => {
      const result = validatePassword("P@ssw0rd!#$%");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("longitud inválida", () => {
    it("rechaza contraseña de menos de 8 caracteres", () => {
      const result = validatePassword("Aa1!xxx");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "La contraseña debe tener al menos 8 caracteres"
      );
    });

    it("rechaza contraseña vacía", () => {
      const result = validatePassword("");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "La contraseña debe tener al menos 8 caracteres"
      );
    });

    it("rechaza contraseña de más de 128 caracteres", () => {
      const password = "Aa1!" + "x".repeat(125);
      expect(password.length).toBe(129);
      const result = validatePassword(password);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "La contraseña no debe exceder 128 caracteres"
      );
    });
  });

  describe("criterios de caracteres", () => {
    it("rechaza contraseña sin mayúscula", () => {
      const result = validatePassword("abcdef1!");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "La contraseña debe contener al menos una letra mayúscula"
      );
    });

    it("rechaza contraseña sin minúscula", () => {
      const result = validatePassword("ABCDEF1!");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "La contraseña debe contener al menos una letra minúscula"
      );
    });

    it("rechaza contraseña sin número", () => {
      const result = validatePassword("Abcdefg!");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "La contraseña debe contener al menos un número"
      );
    });

    it("rechaza contraseña sin carácter especial", () => {
      const result = validatePassword("Abcdefg1");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "La contraseña debe contener al menos un carácter especial"
      );
    });
  });

  describe("múltiples errores", () => {
    it("reporta todos los errores cuando no cumple ningún criterio de caracteres", () => {
      const result = validatePassword("xxxx");
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
    });
  });
});

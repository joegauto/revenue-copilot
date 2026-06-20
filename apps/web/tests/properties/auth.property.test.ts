/**
 * Property 15: Validación de contraseña
 * Validates: Requirements 10.1
 *
 * Genera strings aleatorios y verifica que solo se aceptan
 * los que cumplen todos los criterios de seguridad.
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { validatePassword } from "../../lib/auth/password-validator";

const NUM_RUNS = 200;

// Conjuntos de caracteres
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SPECIAL = "!@#$%^&*()_+-=[]{}|;:<>?,./~";
const ALL_CHARS = UPPER + LOWER + DIGITS + SPECIAL;

/**
 * Generador de contraseñas válidas:
 * 8-128 caracteres con al menos 1 mayúscula, 1 minúscula, 1 dígito, 1 especial
 */
const validPasswordArb = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 1, unit: fc.constantFrom(...UPPER.split("")) }),
    fc.string({ minLength: 1, maxLength: 1, unit: fc.constantFrom(...LOWER.split("")) }),
    fc.string({ minLength: 1, maxLength: 1, unit: fc.constantFrom(...DIGITS.split("")) }),
    fc.string({ minLength: 1, maxLength: 1, unit: fc.constantFrom(...SPECIAL.split("")) }),
    fc.string({ minLength: 4, maxLength: 124, unit: fc.constantFrom(...ALL_CHARS.split("")) })
  )
  .map(([upper, lower, digit, special, rest]) => {
    const chars = (upper + lower + digit + special + rest).split("");
    // Shuffle para distribuir los caracteres obligatorios
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join("");
  });

describe("Property 15: Validación de contraseña", () => {
  /**
   * **Validates: Requirements 10.1**
   * Cualquier string de 8-128 chars con al menos 1 mayúscula,
   * 1 minúscula, 1 dígito y 1 carácter especial → válido
   */
  it("acepta contraseñas que cumplen todos los criterios", () => {
    fc.assert(
      fc.property(validPasswordArb, (password) => {
        const result = validatePassword(password);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 10.1**
   * Strings sin mayúscula → inválido
   */
  it("rechaza contraseñas sin letra mayúscula", () => {
    const noUpperChars = LOWER + DIGITS + SPECIAL;
    const noUpperArb = fc
      .string({ minLength: 8, maxLength: 128, unit: fc.constantFrom(...noUpperChars.split("")) })
      .filter((s) => /[a-z]/.test(s) && /[0-9]/.test(s) && /[^A-Za-z0-9]/.test(s));

    fc.assert(
      fc.property(noUpperArb, (password) => {
        const result = validatePassword(password);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 10.1**
   * Strings sin minúscula → inválido
   */
  it("rechaza contraseñas sin letra minúscula", () => {
    const noLowerChars = UPPER + DIGITS + SPECIAL;
    const noLowerArb = fc
      .string({ minLength: 8, maxLength: 128, unit: fc.constantFrom(...noLowerChars.split("")) })
      .filter((s) => /[A-Z]/.test(s) && /[0-9]/.test(s) && /[^A-Za-z0-9]/.test(s));

    fc.assert(
      fc.property(noLowerArb, (password) => {
        const result = validatePassword(password);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 10.1**
   * Strings sin dígito → inválido
   */
  it("rechaza contraseñas sin número", () => {
    const noDigitChars = UPPER + LOWER + SPECIAL;
    const noDigitArb = fc
      .string({ minLength: 8, maxLength: 128, unit: fc.constantFrom(...noDigitChars.split("")) })
      .filter((s) => /[A-Z]/.test(s) && /[a-z]/.test(s) && /[^A-Za-z0-9]/.test(s));

    fc.assert(
      fc.property(noDigitArb, (password) => {
        const result = validatePassword(password);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 10.1**
   * Strings sin carácter especial → inválido
   */
  it("rechaza contraseñas sin carácter especial", () => {
    const noSpecialChars = UPPER + LOWER + DIGITS;
    const noSpecialArb = fc
      .string({ minLength: 8, maxLength: 128, unit: fc.constantFrom(...noSpecialChars.split("")) })
      .filter((s) => /[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s));

    fc.assert(
      fc.property(noSpecialArb, (password) => {
        const result = validatePassword(password);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 10.1**
   * Strings < 8 caracteres → siempre inválido
   */
  it("rechaza contraseñas con menos de 8 caracteres", () => {
    const shortArb = fc.string({ minLength: 1, maxLength: 7 });

    fc.assert(
      fc.property(shortArb, (password) => {
        const result = validatePassword(password);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("al menos 8"))).toBe(true);
      }),
      { numRuns: NUM_RUNS }
    );
  });

  /**
   * **Validates: Requirements 10.1**
   * Strings > 128 caracteres → siempre inválido
   */
  it("rechaza contraseñas con más de 128 caracteres", () => {
    const longArb = fc.string({
      minLength: 129,
      maxLength: 200,
      unit: fc.constantFrom(...ALL_CHARS.split("")),
    });

    fc.assert(
      fc.property(longArb, (password) => {
        const result = validatePassword(password);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("no debe exceder 128"))).toBe(true);
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

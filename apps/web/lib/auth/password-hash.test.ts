import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password-hash";

describe("hashPassword", () => {
  it("genera un hash bcrypt válido", async () => {
    const hash = await hashPassword("Abcdef1!");
    // Los hashes bcrypt empiezan con $2a$ o $2b$
    expect(hash).toMatch(/^\$2[ab]\$12\$/);
  });

  it("genera hashes diferentes para la misma contraseña (salt único)", async () => {
    const hash1 = await hashPassword("Abcdef1!");
    const hash2 = await hashPassword("Abcdef1!");
    expect(hash1).not.toBe(hash2);
  });

  it("usa 12 rondas de salt", async () => {
    const hash = await hashPassword("TestPass1!");
    // El formato bcrypt incluye el costo: $2a$12$...
    const rounds = hash.split("$")[2];
    expect(rounds).toBe("12");
  });
});

describe("verifyPassword", () => {
  it("verifica correctamente una contraseña válida", async () => {
    const password = "MiPassword1!";
    const hash = await hashPassword(password);
    const result = await verifyPassword(password, hash);
    expect(result).toBe(true);
  });

  it("rechaza una contraseña incorrecta", async () => {
    const hash = await hashPassword("CorrectPass1!");
    const result = await verifyPassword("WrongPass1!", hash);
    expect(result).toBe(false);
  });

  it("rechaza una contraseña vacía contra un hash válido", async () => {
    const hash = await hashPassword("ValidPass1!");
    const result = await verifyPassword("", hash);
    expect(result).toBe(false);
  });
});

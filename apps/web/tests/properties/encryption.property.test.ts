import { describe, it, expect, beforeAll } from "vitest";
import * as fc from "fast-check";
import { encrypt, decrypt } from "@/lib/encryption";

/**
 * Property 17: Round-trip de cifrado AES-256
 * Validates: Requirements 10.5
 */

beforeAll(() => {
  // Set a valid 64-character hex key (32 bytes) for testing
  process.env.ENCRYPTION_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
});

describe("Property 17: Round-trip de cifrado AES-256", () => {
  it("decrypt(encrypt(x)) === x para cualquier string", () => {
    fc.assert(
      fc.property(fc.string(), (plaintext) => {
        const ciphertext = encrypt(plaintext);
        const decrypted = decrypt(ciphertext);
        expect(decrypted).toBe(plaintext);
      }),
      { numRuns: 200 }
    );
  });

  it("decrypt(encrypt(x)) === x para strings unicode", () => {
    fc.assert(
      fc.property(
        fc.string({ unit: "grapheme-composite" }),
        (plaintext) => {
          const ciphertext = encrypt(plaintext);
          const decrypted = decrypt(ciphertext);
          expect(decrypted).toBe(plaintext);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("decrypt(encrypt(x)) === x para strings largos", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 100, maxLength: 10000 }),
        (plaintext) => {
          const ciphertext = encrypt(plaintext);
          const decrypted = decrypt(ciphertext);
          expect(decrypted).toBe(plaintext);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("decrypt(encrypt('')) === '' para string vacío", () => {
    const ciphertext = encrypt("");
    const decrypted = decrypt(ciphertext);
    expect(decrypted).toBe("");
  });

  it("el texto cifrado es distinto al texto plano para cualquier string no vacío", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (plaintext) => {
          const ciphertext = encrypt(plaintext);
          expect(ciphertext).not.toBe(plaintext);
        }
      ),
      { numRuns: 200 }
    );
  });
});

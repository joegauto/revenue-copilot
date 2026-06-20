import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt } from './encryption';

// Valid 32-byte key (64 hex chars)
const TEST_KEY = 'a'.repeat(64);

describe('encryption module', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  describe('encrypt', () => {
    it('should return a string in iv:tag:encrypted format', () => {
      const result = encrypt('hello world');
      const parts = result.split(':');
      expect(parts).toHaveLength(3);
      // IV is 16 bytes = 32 hex chars
      expect(parts[0]).toHaveLength(32);
      // Auth tag is 16 bytes = 32 hex chars
      expect(parts[1]).toHaveLength(32);
      // Encrypted data should be non-empty hex
      expect(parts[2].length).toBeGreaterThan(0);
      expect(/^[0-9a-f]+$/.test(parts[2])).toBe(true);
    });

    it('should produce different ciphertexts for the same plaintext (random IV)', () => {
      const result1 = encrypt('same text');
      const result2 = encrypt('same text');
      expect(result1).not.toBe(result2);
    });

    it('should produce ciphertext different from plaintext', () => {
      const plaintext = 'sensitive data';
      const result = encrypt(plaintext);
      expect(result).not.toContain(plaintext);
    });
  });

  describe('decrypt', () => {
    it('should correctly decrypt an encrypted string', () => {
      const plaintext = 'hello world';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty strings', () => {
      const plaintext = '';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = '¡Hola mundo! 🌍 日本語テスト';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'x'.repeat(10000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should throw on invalid ciphertext format', () => {
      expect(() => decrypt('invalid')).toThrow('Invalid ciphertext format');
      expect(() => decrypt('a:b')).toThrow('Invalid ciphertext format');
    });

    it('should throw on tampered ciphertext', () => {
      const encrypted = encrypt('test');
      const parts = encrypted.split(':');
      // Tamper with the encrypted data
      parts[2] = '00'.repeat(parts[2].length / 2);
      expect(() => decrypt(parts.join(':'))).toThrow();
    });
  });

  describe('key validation', () => {
    it('should throw if ENCRYPTION_KEY is not set', () => {
      delete process.env.ENCRYPTION_KEY;
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY environment variable is not set');
    });

    it('should throw if ENCRYPTION_KEY is too short', () => {
      process.env.ENCRYPTION_KEY = 'abcd';
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be a valid 64-character hex string');
    });

    it('should throw if ENCRYPTION_KEY contains non-hex characters', () => {
      process.env.ENCRYPTION_KEY = 'g'.repeat(64);
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be a valid 64-character hex string');
    });
  });
});

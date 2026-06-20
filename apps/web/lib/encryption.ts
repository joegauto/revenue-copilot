import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is not set. It must be a 64-character hex string (32 bytes).'
    );
  }
  if (keyHex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(
      'ENCRYPTION_KEY must be a valid 64-character hex string (32 bytes).'
    );
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a string in the format: iv_hex:auth_tag_hex:encrypted_hex
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a ciphertext string produced by encrypt().
 * Expects format: iv_hex:auth_tag_hex:encrypted_hex
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error(
      'Invalid ciphertext format. Expected format: iv_hex:auth_tag_hex:encrypted_hex'
    );
  }
  const [ivHex, tagHex, encHex] = parts;
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encHex, 'hex')) + decipher.final('utf8');
}

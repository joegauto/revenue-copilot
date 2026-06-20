/**
 * Hashing y verificación de contraseñas con bcrypt.
 * Requisito 10.1: Hash bcrypt con mínimo 12 rondas.
 */

import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * Genera un hash bcrypt de la contraseña con 12 rondas de salt.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(password, salt);
}

/**
 * Verifica una contraseña contra un hash bcrypt existente.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

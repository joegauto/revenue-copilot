/**
 * Validación de contraseñas para Revenue Copilot.
 * Requisito 10.1: Contraseñas de 8-128 caracteres con al menos
 * 1 mayúscula, 1 minúscula, 1 número y 1 carácter especial.
 */

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

/**
 * Valida que una contraseña cumpla con todos los criterios de seguridad.
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < MIN_LENGTH) {
    errors.push(`La contraseña debe tener al menos ${MIN_LENGTH} caracteres`);
  }

  if (password.length > MAX_LENGTH) {
    errors.push(`La contraseña no debe exceder ${MAX_LENGTH} caracteres`);
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("La contraseña debe contener al menos una letra mayúscula");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("La contraseña debe contener al menos una letra minúscula");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("La contraseña debe contener al menos un número");
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("La contraseña debe contener al menos un carácter especial");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

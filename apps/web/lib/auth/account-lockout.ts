/**
 * Servicio de bloqueo de cuenta por intentos fallidos.
 * Requisito 10.4: Bloquear cuenta tras 5 intentos fallidos consecutivos por 15 minutos.
 *
 * Usa un store en memoria (Map) como implementación por defecto.
 * Preparado para migrar a Redis cuando se configure la conexión.
 */

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutos

interface LockoutRecord {
  failedAttempts: number;
  lockedUntil: number | null; // timestamp en ms
}

// Store en memoria — en producción se reemplaza por Redis
// Key: email normalizado
const lockoutStore = new Map<string, LockoutRecord>();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getRecord(email: string): LockoutRecord {
  const key = normalizeEmail(email);
  return lockoutStore.get(key) ?? { failedAttempts: 0, lockedUntil: null };
}

function setRecord(email: string, record: LockoutRecord): void {
  const key = normalizeEmail(email);
  lockoutStore.set(key, record);
}

/**
 * Verifica si una cuenta está bloqueada.
 * Si el bloqueo ha expirado, lo limpia automáticamente.
 */
export async function checkAccountLocked(
  email: string
): Promise<{ locked: boolean; minutesRemaining?: number }> {
  const record = getRecord(email);

  if (!record.lockedUntil) {
    return { locked: false };
  }

  const now = Date.now();

  if (now >= record.lockedUntil) {
    // El bloqueo ha expirado — limpiar
    setRecord(email, { failedAttempts: 0, lockedUntil: null });
    return { locked: false };
  }

  const msRemaining = record.lockedUntil - now;
  const minutesRemaining = Math.ceil(msRemaining / 60_000);

  return { locked: true, minutesRemaining };
}

/**
 * Registra un intento fallido de autenticación.
 * Si se alcanzan 5 intentos, bloquea la cuenta por 15 minutos.
 */
export async function recordFailedAttempt(
  email: string
): Promise<{ locked: boolean; attemptsRemaining: number }> {
  const record = getRecord(email);

  const newAttempts = record.failedAttempts + 1;

  if (newAttempts >= MAX_FAILED_ATTEMPTS) {
    // Bloquear la cuenta
    setRecord(email, {
      failedAttempts: newAttempts,
      lockedUntil: Date.now() + LOCKOUT_DURATION_MS,
    });
    return { locked: true, attemptsRemaining: 0 };
  }

  setRecord(email, {
    failedAttempts: newAttempts,
    lockedUntil: null,
  });

  return {
    locked: false,
    attemptsRemaining: MAX_FAILED_ATTEMPTS - newAttempts,
  };
}

/**
 * Reinicia el contador de intentos fallidos tras un login exitoso.
 */
export async function resetFailedAttempts(email: string): Promise<void> {
  const key = normalizeEmail(email);
  lockoutStore.delete(key);
}

// Exportar constantes para tests
export const LOCKOUT_CONFIG = {
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MS,
} as const;

// Exportar para testing — permite limpiar el store entre tests
export function _clearStore(): void {
  lockoutStore.clear();
}

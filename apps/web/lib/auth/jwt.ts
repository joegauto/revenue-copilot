/**
 * Módulo JWT — Generación y verificación de tokens con jose.
 * Requisito 10.2: Tokens JWT con expiración máxima de 24 horas.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export interface TokenPayload {
  tenantId: string;
  userId: string;
  email: string;
}

export interface VerifiedPayload extends JWTPayload {
  tenantId: string;
  userId: string;
  email: string;
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET environment variable is not set. It must be a string of at least 32 characters."
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Genera un token JWT con expiración de 24 horas.
 */
export async function generateToken(payload: TokenPayload): Promise<string> {
  const secret = getJwtSecret();

  const token = await new SignJWT({
    tenantId: payload.tenantId,
    userId: payload.userId,
    email: payload.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);

  return token;
}

/**
 * Verifica y decodifica un token JWT.
 * Lanza error si el token es inválido o ha expirado.
 */
export async function verifyToken(token: string): Promise<VerifiedPayload> {
  const secret = getJwtSecret();

  const { payload } = await jwtVerify(token, secret);

  if (!payload.tenantId || !payload.userId || !payload.email) {
    throw new Error("Token payload is missing required fields");
  }

  return payload as VerifiedPayload;
}

/**
 * POST /api/auth/login — Login con email/password → JWT.
 * Requisitos 10.2, 10.3, 10.4
 *
 * Autentica al Tenant y retorna un token JWT con expiración de 24h.
 * Implementa bloqueo de cuenta tras 5 intentos fallidos (15 min).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password-hash";
import { generateToken } from "@/lib/auth/jwt";
import {
  checkAccountLocked,
  recordFailedAttempt,
  resetFailedAttempts,
} from "@/lib/auth/account-lockout";

interface LoginBody {
  email: string;
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: LoginBody = await request.json();

    // Validar campos requeridos
    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: "Los campos email y password son obligatorios" },
        { status: 400 }
      );
    }

    // Verificar si la cuenta está bloqueada (Requisito 10.4)
    const lockStatus = await checkAccountLocked(body.email);
    if (lockStatus.locked) {
      return NextResponse.json(
        {
          error: `La cuenta ha sido bloqueada temporalmente. Intente nuevamente en ${lockStatus.minutesRemaining} minuto(s).`,
          code: "AUTH_002",
          minutesRemaining: lockStatus.minutesRemaining,
        },
        { status: 423 }
      );
    }

    // Buscar tenant por email
    const tenant = await prisma.tenant.findUnique({
      where: { email: body.email },
    });

    if (!tenant) {
      // Registrar intento fallido incluso si el usuario no existe
      // para evitar enumeración de cuentas
      await recordFailedAttempt(body.email);
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    // Verificar que la cuenta esté activa
    if (!tenant.isActive) {
      return NextResponse.json(
        { error: "La cuenta está desactivada" },
        { status: 403 }
      );
    }

    // Verificar contraseña
    const isValidPassword = await verifyPassword(
      body.password,
      tenant.passwordHash
    );

    if (!isValidPassword) {
      // Registrar intento fallido (Requisito 10.4)
      const attemptResult = await recordFailedAttempt(body.email);

      if (attemptResult.locked) {
        return NextResponse.json(
          {
            error:
              "La cuenta ha sido bloqueada temporalmente por múltiples intentos fallidos. Intente nuevamente en 15 minuto(s).",
            code: "AUTH_002",
            minutesRemaining: 15,
          },
          { status: 423 }
        );
      }

      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    // Login exitoso — reiniciar contador de intentos fallidos (Requisito 10.4)
    await resetFailedAttempts(body.email);

    // Generar JWT
    const token = await generateToken({
      tenantId: tenant.id,
      userId: tenant.id,
      email: tenant.email,
    });

    return NextResponse.json({
      token,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        email: tenant.email,
      },
    });
  } catch (error) {
    console.error("Error en login:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

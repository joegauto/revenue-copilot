/**
 * POST /api/auth/register — Registro de nuevo Tenant.
 * Requisitos 10.1, 10.2, 8.3
 *
 * Crea un nuevo Tenant con su configuración por defecto y retorna un JWT.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validatePassword } from "@/lib/auth/password-validator";
import { hashPassword } from "@/lib/auth/password-hash";
import { generateToken } from "@/lib/auth/jwt";
import { createDefaultWorkspace } from "@/lib/tenant/workspace-setup";

interface RegisterBody {
  name: string;
  email: string;
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RegisterBody = await request.json();

    // Validar campos requeridos
    if (!body.name || !body.email || !body.password) {
      return NextResponse.json(
        { error: "Los campos name, email y password son obligatorios" },
        { status: 400 }
      );
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: "El formato del email no es válido" },
        { status: 400 }
      );
    }

    // Validar contraseña
    const passwordValidation = validatePassword(body.password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: "Contraseña inválida", details: passwordValidation.errors },
        { status: 400 }
      );
    }

    // Verificar que el email no esté registrado
    const existingTenant = await prisma.tenant.findUnique({
      where: { email: body.email },
    });

    if (existingTenant) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con este email" },
        { status: 409 }
      );
    }

    // Hash de la contraseña
    const passwordHash = await hashPassword(body.password);

    // Crear Tenant con configuración por defecto
    const tenant = await prisma.tenant.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash,
      },
    });

    // Crear workspace con configuración por defecto (scoring, plantilla)
    await createDefaultWorkspace(tenant.id, prisma);

    // Generar JWT
    const token = await generateToken({
      tenantId: tenant.id,
      userId: tenant.id,
      email: tenant.email,
    });

    return NextResponse.json(
      {
        token,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          email: tenant.email,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error en registro:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

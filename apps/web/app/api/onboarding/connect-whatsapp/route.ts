/**
 * POST /api/onboarding/connect-whatsapp — Configurar credenciales WhatsApp.
 *
 * Verifica las credenciales contra la API de Meta.
 * Si inválidas → rechaza conexión + notifica tenant.
 *
 * Requisito: 6.7
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type AuthContext } from "@/lib/auth/auth-guard";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";

const ConnectWhatsAppSchema = z.object({
  phoneNumberId: z.string().min(1, "Phone Number ID es obligatorio"),
  accessToken: z.string().min(10, "Access Token es obligatorio"),
  verifyToken: z.string().min(1, "Verify Token es obligatorio"),
  businessName: z.string().optional(),
});

export const POST = withAuth(
  async (request: NextRequest, { tenantId }: AuthContext) => {
    const body = await request.json();
    const parsed = ConnectWhatsAppSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { phoneNumberId, accessToken, verifyToken } = parsed.data;

    // Verificar credenciales contra WhatsApp API
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${phoneNumberId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!response.ok) {
        return NextResponse.json(
          {
            success: false,
            error: "Credenciales inválidas. Verifica el Phone Number ID y Access Token.",
            code: "WHATSAPP_INVALID_CREDENTIALS",
          },
          { status: 401 }
        );
      }
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "No se pudo conectar con WhatsApp API. Intenta nuevamente.",
        },
        { status: 502 }
      );
    }

    // Guardar credenciales cifradas
    const encryptedToken = encrypt(accessToken);

    await prisma.whatsAppConfig.upsert({
      where: { tenantId },
      update: {
        phoneNumberId,
        accessTokenEncrypted: encryptedToken,
        verifyToken,
        isActive: true,
      },
      create: {
        tenantId,
        phoneNumberId,
        accessTokenEncrypted: encryptedToken,
        verifyToken,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: { phoneNumberId, connected: true },
    });
  }
);

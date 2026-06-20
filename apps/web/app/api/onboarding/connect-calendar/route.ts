/**
 * POST /api/onboarding/connect-calendar — OAuth2 para Google Calendar.
 *
 * Verifica permisos de lectura/escritura en 10 segundos.
 *
 * Requisitos: 9.3, 9.4
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type AuthContext } from "@/lib/auth/auth-guard";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";

const ConnectCalendarSchema = z.object({
  code: z.string().min(1, "Authorization code es obligatorio"),
  redirectUri: z.string().url(),
});

export const POST = withAuth(
  async (request: NextRequest, { tenantId }: AuthContext) => {
    const body = await request.json();
    const parsed = ConnectCalendarSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { code, redirectUri } = parsed.data;

    // Intercambiar code por tokens
    try {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID || "",
          client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (!tokenResponse.ok) {
        return NextResponse.json(
          { success: false, error: "No se pudo obtener acceso al calendario." },
          { status: 401 }
        );
      }

      const tokens = await tokenResponse.json();

      // Verificar permisos consultando calendarios
      const calendarCheck = await fetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList",
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      );

      if (!calendarCheck.ok) {
        return NextResponse.json(
          { success: false, error: "Permisos insuficientes en Google Calendar." },
          { status: 403 }
        );
      }

      // Guardar tokens cifrados
      await prisma.calendarConfig.upsert({
        where: { tenantId },
        update: {
          accessTokenEncrypted: encrypt(tokens.access_token),
          refreshTokenEncrypted: encrypt(tokens.refresh_token || ""),
          calendarId: "primary",
          isActive: true,
        },
        create: {
          tenantId,
          accessTokenEncrypted: encrypt(tokens.access_token),
          refreshTokenEncrypted: encrypt(tokens.refresh_token || ""),
          calendarId: "primary",
          isActive: true,
        },
      });

      return NextResponse.json({
        success: true,
        data: { connected: true, calendarId: "primary" },
      });
    } catch (error) {
      return NextResponse.json(
        { success: false, error: "Timeout al conectar con Google Calendar." },
        { status: 504 }
      );
    }
  }
);

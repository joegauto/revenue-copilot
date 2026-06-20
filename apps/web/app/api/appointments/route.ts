/**
 * GET /api/appointments — Listar citas del tenant.
 * Requisito: 5.1
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthContext } from "@/lib/auth/auth-guard";

export const GET = withAuth(
  async (_request: NextRequest, { tenantId }: AuthContext) => {
    const appointments = await prisma.appointment.findMany({
      where: { tenantId },
      include: { lead: { select: { name: true } } },
      orderBy: { startTime: "asc" },
      take: 50,
    });

    return NextResponse.json({ success: true, data: appointments });
  }
);

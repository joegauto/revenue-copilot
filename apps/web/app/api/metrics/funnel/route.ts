/**
 * GET /api/metrics/funnel — Datos del embudo de conversión.
 *
 * Etapas: nuevo → contactado → calificado → cita → convertido.
 *
 * Requisito: 7.4
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthContext } from "@/lib/auth/auth-guard";

export const GET = withAuth(
  async (request: NextRequest, { tenantId }: AuthContext) => {
    const days = Math.min(
      365,
      Math.max(1, parseInt(request.nextUrl.searchParams.get("days") || "30"))
    );
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const where = { tenantId, createdAt: { gte: since } };

    const [total, contacted, qualified, withAppointment, converted] =
      await Promise.all([
        prisma.lead.count({ where }),
        prisma.lead.count({ where: { ...where, status: { in: ["in_progress", "qualified", "converted"] } } }),
        prisma.lead.count({ where: { ...where, status: { in: ["qualified", "converted"] } } }),
        prisma.lead.count({ where: { ...where, qualifiedAt: { not: null } } }),
        prisma.lead.count({ where: { ...where, convertedAt: { not: null } } }),
      ]);

    const funnel = [
      { stage: "nuevo", count: total, rate: 100 },
      { stage: "contactado", count: contacted, rate: total > 0 ? Math.round((contacted / total) * 100) : 0 },
      { stage: "calificado", count: qualified, rate: total > 0 ? Math.round((qualified / total) * 100) : 0 },
      { stage: "cita_agendada", count: withAppointment, rate: total > 0 ? Math.round((withAppointment / total) * 100) : 0 },
      { stage: "convertido", count: converted, rate: total > 0 ? Math.round((converted / total) * 100) : 0 },
    ];

    return NextResponse.json({ success: true, data: { funnel, period: { days } } });
  }
);

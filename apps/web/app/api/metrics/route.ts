/**
 * GET /api/metrics — Métricas comerciales del tenant.
 *
 * Retorna: leads activos, calificados, citas, tasa de conversión,
 * score promedio. Filtro por rango de fechas (1-365 días, default 30).
 *
 * Requisitos: 7.1, 7.2, 7.3, 7.4
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

    const [leads, qualified, appointments, conversations] = await Promise.all([
      prisma.lead.count({ where: { tenantId, createdAt: { gte: since } } }),
      prisma.lead.count({ where: { tenantId, status: "qualified", createdAt: { gte: since } } }),
      prisma.appointment.count({ where: { tenantId, createdAt: { gte: since } } }),
      prisma.conversation.count({ where: { tenantId, startedAt: { gte: since } } }),
    ]);

    const avgScore = await prisma.lead.aggregate({
      where: { tenantId, createdAt: { gte: since } },
      _avg: { score: true },
    });

    const conversionRate = leads > 0 ? (qualified / leads) * 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        period: { days, since: since.toISOString() },
        kpis: {
          leadsActivos: leads,
          leadsCalificados: qualified,
          citasAgendadas: appointments,
          conversacionesActivas: conversations,
          tasaConversion: Math.round(conversionRate * 10) / 10,
          scorePromedio: Math.round(avgScore._avg.score || 0),
        },
      },
    });
  }
);

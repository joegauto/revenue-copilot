/**
 * GET /api/leads — Listar leads del tenant con paginación.
 * Requisitos: 7.1, 1.4
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthContext } from "@/lib/auth/auth-guard";

export const GET = withAuth(
  async (request: NextRequest, { tenantId }: AuthContext) => {
    const page = parseInt(request.nextUrl.searchParams.get("page") || "1");
    const limit = Math.min(50, parseInt(request.nextUrl.searchParams.get("limit") || "20"));
    const status = request.nextUrl.searchParams.get("status");

    const where: Record<string, unknown> = { tenantId };
    if (status) where.status = status;

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: leads,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  }
);

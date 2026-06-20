/**
 * GET /api/conversations — Listar conversaciones del tenant.
 * Requisito: 7.2
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthContext } from "@/lib/auth/auth-guard";

export const GET = withAuth(
  async (request: NextRequest, { tenantId }: AuthContext) => {
    const status = request.nextUrl.searchParams.get("status") || "active";

    const conversations = await prisma.conversation.findMany({
      where: { tenantId, status },
      include: { lead: { select: { name: true } } },
      orderBy: { lastActiveAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ success: true, data: conversations });
  }
);

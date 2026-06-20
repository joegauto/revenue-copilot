/**
 * API de gestión de secuencias de seguimiento.
 *
 * GET /api/settings/sequences — Listar secuencias del tenant.
 * POST /api/settings/sequences — Crear nueva secuencia.
 *
 * Validaciones: máximo 10 activas, máximo 3 pasos, intervalos 1-72h.
 *
 * Requisitos: 4.1, 4.2, 8.4
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthContext } from "@/lib/auth/auth-guard";

const StepSchema = z.object({
  stepNumber: z.number().int().min(1).max(3),
  intervalHours: z.number().int().min(1).max(72),
  messageTemplate: z.string().min(1).max(1000),
  channel: z.string().optional(),
});

const CreateSequenceSchema = z.object({
  name: z.string().min(1).max(100),
  triggerAfterHours: z.number().int().min(1).max(168),
  steps: z.array(StepSchema).min(1).max(3),
  segment: z.string().optional(),
});

export const GET = withAuth(
  async (_request: NextRequest, { tenantId }: AuthContext) => {
    const sequences = await prisma.followUpSequence.findMany({
      where: { tenantId },
      include: { steps: { orderBy: { stepNumber: "asc" } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: sequences });
  }
);

export const POST = withAuth(
  async (request: NextRequest, { tenantId }: AuthContext) => {
    const body = await request.json();
    const parsed = CreateSequenceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verificar límite de 10 secuencias activas
    const activeCount = await prisma.followUpSequence.count({
      where: { tenantId, isActive: true },
    });

    if (activeCount >= 10) {
      return NextResponse.json(
        { success: false, error: "Máximo 10 secuencias activas permitidas." },
        { status: 400 }
      );
    }

    const { name, triggerAfterHours, steps, segment } = parsed.data;

    const sequence = await prisma.followUpSequence.create({
      data: {
        tenantId,
        name,
        triggerAfterHours,
        segment: segment || null,
        isActive: true,
        steps: {
          create: steps.map((s) => ({
            stepNumber: s.stepNumber,
            intervalHours: s.intervalHours,
            messageTemplate: s.messageTemplate,
            channel: s.channel || null,
          })),
        },
      },
      include: { steps: true },
    });

    return NextResponse.json({ success: true, data: sequence }, { status: 201 });
  }
);

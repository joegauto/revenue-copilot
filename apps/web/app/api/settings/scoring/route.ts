/**
 * PATCH /api/settings/scoring — Actualizar pesos y umbral de scoring.
 * Requisito 2.5
 *
 * Valida que pesos sumen 100 (Zod) y que umbral esté entre 1 y 99.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthContext } from "@/lib/auth/auth-guard";

const ScoringConfigSchema = z
  .object({
    weightQualification: z.number().int().min(0).max(100).optional(),
    weightEngagement: z.number().int().min(0).max(100).optional(),
    weightDemographics: z.number().int().min(0).max(100).optional(),
    weightResponseSpeed: z.number().int().min(0).max(100).optional(),
    qualificationThreshold: z.number().int().min(1).max(99).optional(),
  })
  .refine(
    (data) => {
      const weights = [
        data.weightQualification,
        data.weightEngagement,
        data.weightDemographics,
        data.weightResponseSpeed,
      ];
      // Si se envía al menos un peso, todos deben estar presentes y sumar 100
      const hasAnyWeight = weights.some((w) => w !== undefined);
      if (!hasAnyWeight) return true;
      const allPresent = weights.every((w) => w !== undefined);
      if (!allPresent) return false;
      return (weights as number[]).reduce((a, b) => a + b, 0) === 100;
    },
    {
      message:
        "Si se modifican los pesos, todos deben estar presentes y sumar exactamente 100",
    }
  );

export const PATCH = withAuth(
  async (request: NextRequest, { tenantId }: AuthContext) => {
    try {
      const body = await request.json();
      const parsed = ScoringConfigSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const data = parsed.data;
      const updatePayload: Record<string, unknown> = {};

      if (data.weightQualification !== undefined) {
        updatePayload.weightQualification = data.weightQualification;
        updatePayload.weightEngagement = data.weightEngagement;
        updatePayload.weightDemographics = data.weightDemographics;
        updatePayload.weightResponseSpeed = data.weightResponseSpeed;
      }

      if (data.qualificationThreshold !== undefined) {
        updatePayload.qualificationThreshold = data.qualificationThreshold;
      }

      if (Object.keys(updatePayload).length === 0) {
        return NextResponse.json(
          { success: false, error: "No hay campos para actualizar" },
          { status: 400 }
        );
      }

      const config = await prisma.scoringConfig.upsert({
        where: { tenantId },
        update: updatePayload,
        create: {
          tenantId,
          ...updatePayload,
          qualificationQuestions: [],
          targetProfile: {},
        } as any,
      });

      return NextResponse.json({ success: true, data: config });
    } catch (error) {
      console.error("Error actualizando scoring config:", error);
      return NextResponse.json(
        { success: false, error: "Error interno del servidor" },
        { status: 500 }
      );
    }
  }
);

export const GET = withAuth(
  async (_request: NextRequest, { tenantId }: AuthContext) => {
    const config = await prisma.scoringConfig.findUnique({
      where: { tenantId },
    });

    if (!config) {
      return NextResponse.json({
        success: true,
        data: {
          weightQualification: 40,
          weightEngagement: 25,
          weightDemographics: 20,
          weightResponseSpeed: 15,
          qualificationThreshold: 60,
        },
      });
    }

    return NextResponse.json({ success: true, data: config });
  }
);

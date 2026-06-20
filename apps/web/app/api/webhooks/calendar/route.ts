/**
 * Webhook handler de Google Calendar.
 *
 * Procesa notificaciones de cambios en eventos (push notifications).
 *
 * Requisito: 9.3
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // Google Calendar push notification headers
  const channelId = request.headers.get("x-goog-channel-id");
  const resourceState = request.headers.get("x-goog-resource-state");

  if (resourceState === "sync") {
    // Initial sync — acknowledge
    return new NextResponse(null, { status: 200 });
  }

  // ponytail: procesar cambios de eventos en wiring (task 19).
  console.log("[Calendar Webhook]", { channelId, resourceState });

  return new NextResponse(null, { status: 200 });
}

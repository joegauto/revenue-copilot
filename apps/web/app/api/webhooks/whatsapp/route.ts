/**
 * Webhook handler de WhatsApp Business Cloud API.
 *
 * GET — Verificación de webhook (Meta challenge).
 * POST — Procesa mensajes entrantes y notificaciones de estado.
 *
 * Requisitos: 6.2, 6.6, 6.8
 */

import { NextRequest, NextResponse } from "next/server";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "revenue-copilot-verify";

/**
 * GET /api/webhooks/whatsapp — Verificación de webhook.
 * Meta envía un challenge que debemos devolver.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

interface WhatsAppWebhookBody {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { phone_number_id: string; display_phone_number: string };
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          image?: { id: string; mime_type: string };
          document?: { id: string; mime_type: string; filename: string };
          audio?: { id: string; mime_type: string };
          location?: { latitude: number; longitude: number };
        }>;
        statuses?: Array<{
          id: string;
          status: "sent" | "delivered" | "read" | "failed";
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

/**
 * POST /api/webhooks/whatsapp — Procesa mensajes y estados.
 */
export async function POST(request: NextRequest) {
  try {
    const body: WhatsAppWebhookBody = await request.json();

    if (body.object !== "whatsapp_business_account") {
      return NextResponse.json({ error: "Invalid object" }, { status: 400 });
    }

    for (const entry of body.entry) {
      for (const change of entry.changes) {
        if (change.field !== "messages") continue;
        const value = change.value;

        // Procesar mensajes entrantes
        if (value.messages) {
          for (const msg of value.messages) {
            await handleIncomingMessage(msg, value.metadata, value.contacts);
          }
        }

        // Procesar estados de entrega
        if (value.statuses) {
          for (const status of value.statuses) {
            await handleStatusUpdate(status);
          }
        }
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Error procesando webhook WhatsApp:", error);
    return NextResponse.json({ status: "ok" }); // Siempre 200 para no re-envíos
  }
}

async function handleIncomingMessage(
  msg: NonNullable<WhatsAppWebhookBody["entry"][0]["changes"][0]["value"]["messages"]>[0],
  metadata: { phone_number_id: string },
  contacts?: Array<{ profile: { name: string }; wa_id: string }>
) {
  // Normalizar al formato IncomingMessage del sistema
  let content = "";
  const messageType = msg.type;

  switch (msg.type) {
    case "text":
      content = msg.text?.body || "";
      break;
    case "image":
    case "document":
    case "audio":
      content = `[${msg.type}]`; // Placeholder — se descarga via Media API
      break;
    case "location":
      content = `[ubicación: ${msg.location?.latitude}, ${msg.location?.longitude}]`;
      break;
    default:
      // Tipo no soportado — responder con formato alternativo
      content = "[tipo_no_soportado]";
  }

  const contactName = contacts?.[0]?.profile?.name || "Unknown";

  // ponytail: enviar al Message Router se conecta en task 19 (wiring).
  // Por ahora logueamos el mensaje normalizado.
  console.log("[WhatsApp Incoming]", {
    from: msg.from,
    name: contactName,
    type: messageType,
    content: content.slice(0, 100),
    timestamp: msg.timestamp,
    phoneNumberId: metadata.phone_number_id,
  });
}

async function handleStatusUpdate(
  status: NonNullable<WhatsAppWebhookBody["entry"][0]["changes"][0]["value"]["statuses"]>[0]
) {
  // ponytail: actualizar delivery status en DB se conecta en wiring.
  console.log("[WhatsApp Status]", {
    messageId: status.id,
    status: status.status,
    recipient: status.recipient_id,
  });
}

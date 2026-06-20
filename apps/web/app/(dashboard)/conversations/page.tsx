/**
 * Página de Conversaciones — Lista de conversaciones activas.
 * Requisito: 7.2
 */

"use client";

import { useEffect, useState } from "react";

interface Conversation {
  id: string;
  leadName: string;
  channel: string;
  status: string;
  lastMessage: string;
  lastActiveAt: string;
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((data) => setConversations(data.data || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-500">Cargando...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Conversaciones</h1>
      <div className="space-y-3">
        {conversations.map((conv) => (
          <div key={conv.id} className="bg-white rounded-xl border p-4 hover:shadow-sm transition">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">{conv.leadName || "Lead sin nombre"}</p>
                <p className="text-sm text-gray-500 mt-1 line-clamp-1">{conv.lastMessage}</p>
              </div>
              <div className="text-right text-xs text-gray-400">
                <p>{conv.channel}</p>
                <p>{new Date(conv.lastActiveAt).toLocaleString()}</p>
              </div>
            </div>
          </div>
        ))}
        {conversations.length === 0 && (
          <p className="text-center text-gray-400 py-8">No hay conversaciones activas.</p>
        )}
      </div>
    </div>
  );
}

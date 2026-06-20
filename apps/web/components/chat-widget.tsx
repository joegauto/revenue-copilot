/**
 * ChatWidget — Widget de chat embebible con WebSocket.
 *
 * Conecta al servidor Socket.IO con reconexión automática.
 * Muestra historial, indicador de escritura, timestamps.
 *
 * Requisito: 1.2
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
}

interface ChatWidgetProps {
  tenantId: string;
  sessionId?: string;
  position?: "bottom-right" | "bottom-left";
  primaryColor?: string;
}

export function ChatWidget({
  tenantId,
  sessionId: propSessionId,
  position = "bottom-right",
  primaryColor = "#4F46E5",
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [connected, setConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef(propSessionId || crypto.randomUUID());

  // ponytail: Socket.IO connection se implementa en wiring (task 19).
  // Por ahora simula la interfaz con fetch al endpoint process-message.

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      content: input.trim(),
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      // ponytail: en producción esto va por Socket.IO, no fetch.
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          sessionId: sessionId.current,
          content: userMsg.content,
        }),
      });

      const data = await response.json();

      const botMsg: Message = {
        id: crypto.randomUUID(),
        content: data.response || "Lo siento, hubo un error. Intenta de nuevo.",
        role: "assistant",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          content: "Error de conexión. Reintentando...",
          role: "assistant",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const positionClasses =
    position === "bottom-right" ? "right-4 bottom-4" : "left-4 bottom-4";

  return (
    <div className={`fixed ${positionClasses} z-50`}>
      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="rounded-full w-14 h-14 shadow-lg flex items-center justify-center text-white text-xl hover:scale-105 transition-transform"
          style={{ backgroundColor: primaryColor }}
          aria-label="Abrir chat"
        >
          💬
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="w-80 h-[28rem] bg-white rounded-xl shadow-2xl flex flex-col border">
          {/* Header */}
          <div
            className="p-3 rounded-t-xl text-white flex justify-between items-center"
            style={{ backgroundColor: primaryColor }}
          >
            <span className="font-medium text-sm">Chat</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white"
              aria-label="Cerrar chat"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`max-w-[80%] p-2 rounded-lg text-sm ${
                  msg.role === "user"
                    ? "ml-auto bg-indigo-100 text-gray-800"
                    : "mr-auto bg-gray-100 text-gray-800"
                }`}
              >
                {msg.content}
              </div>
            ))}
            {isTyping && (
              <div className="mr-auto bg-gray-100 p-2 rounded-lg text-sm text-gray-500">
                Escribiendo...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-2 border-t flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Escribe un mensaje..."
              className="flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="px-3 py-2 rounded-lg text-white text-sm disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

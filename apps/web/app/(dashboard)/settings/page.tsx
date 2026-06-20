/**
 * Página de Configuración del tenant.
 * Secciones: scoring, secuencias, KB, integraciones, tono, horarios.
 * Requisitos: 2.5, 8.4
 */

"use client";

import { useState } from "react";

type Section = "scoring" | "sequences" | "knowledge" | "integrations" | "tone" | "schedule";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "scoring", label: "Calificación" },
  { id: "sequences", label: "Secuencias" },
  { id: "knowledge", label: "Base de Conocimiento" },
  { id: "integrations", label: "Integraciones" },
  { id: "tone", label: "Tono de Comunicación" },
  { id: "schedule", label: "Horarios" },
];

export default function SettingsPage() {
  const [active, setActive] = useState<Section>("scoring");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Configuración</h1>
      <div className="flex gap-6">
        <nav className="w-48 space-y-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                active === s.id ? "bg-indigo-50 text-indigo-700 font-medium" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="flex-1 bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold capitalize mb-4">
            {SECTIONS.find((s) => s.id === active)?.label}
          </h2>
          <p className="text-sm text-gray-500">
            Configuración de {active}. Los cambios se guardan automáticamente.
          </p>
          {/* ponytail: formularios específicos se implementan incrementalmente */}
        </div>
      </div>
    </div>
  );
}

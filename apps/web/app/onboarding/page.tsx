/**
 * Asistente de configuración guiado (Onboarding).
 *
 * Pasos: 1) Conectar canales, 2) Cargar KB, 3) Scoring, 4) Agenda.
 * Inicia en max 3s tras registro. Guarda progreso auto.
 *
 * Requisitos: 9.1, 9.6
 */

"use client";

import { useState, useEffect } from "react";

type Step = "channels" | "knowledge" | "scoring" | "calendar";

const STEPS: { id: Step; title: string; description: string }[] = [
  { id: "channels", title: "Conectar Canales", description: "Configura WhatsApp o web chat." },
  { id: "knowledge", title: "Base de Conocimiento", description: "Carga info de tu negocio." },
  { id: "scoring", title: "Criterios de Calificación", description: "Define qué es un lead calificado." },
  { id: "calendar", title: "Configurar Agenda", description: "Conecta Google Calendar." },
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [completed, setCompleted] = useState<Set<Step>>(new Set());

  // Cargar progreso guardado
  useEffect(() => {
    const saved = localStorage.getItem("onboarding_progress");
    if (saved) {
      const data = JSON.parse(saved);
      setCurrentStep(data.currentStep || 0);
      setCompleted(new Set(data.completed || []));
    }
  }, []);

  // Guardar progreso automáticamente
  useEffect(() => {
    localStorage.setItem(
      "onboarding_progress",
      JSON.stringify({ currentStep, completed: [...completed] })
    );
  }, [currentStep, completed]);

  const markComplete = (step: Step) => {
    setCompleted((prev) => new Set([...prev, step]));
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const step = STEPS[currentStep];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar Progress */}
      <aside className="w-64 bg-white border-r p-6">
        <h2 className="text-lg font-bold mb-6">Configuración</h2>
        <nav className="space-y-3">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setCurrentStep(i)}
              className={`w-full text-left p-3 rounded-lg text-sm ${
                i === currentStep
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : completed.has(s.id)
                    ? "text-green-600"
                    : "text-gray-500"
              }`}
            >
              <span className="mr-2">{completed.has(s.id) ? "✓" : `${i + 1}.`}</span>
              {s.title}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 max-w-2xl">
        <h1 className="text-2xl font-bold">{step.title}</h1>
        <p className="text-gray-600 mt-2">{step.description}</p>

        <div className="mt-8 bg-white rounded-xl border p-6">
          {step.id === "channels" && <ChannelsStep onComplete={() => markComplete("channels")} />}
          {step.id === "knowledge" && <KnowledgeStep onComplete={() => markComplete("knowledge")} />}
          {step.id === "scoring" && <ScoringStep onComplete={() => markComplete("scoring")} />}
          {step.id === "calendar" && <CalendarStep onComplete={() => markComplete("calendar")} />}
        </div>
      </main>
    </div>
  );
}

function ChannelsStep({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Conecta al menos un canal para empezar.</p>
      <button className="w-full p-4 border rounded-lg text-left hover:bg-gray-50">
        📱 WhatsApp Business
      </button>
      <button className="w-full p-4 border rounded-lg text-left hover:bg-gray-50">
        💬 Web Chat Widget
      </button>
      <button onClick={onComplete} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
        Continuar
      </button>
    </div>
  );
}

function KnowledgeStep({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Sube información de tu negocio (texto, PDF, o URL).</p>
      <textarea
        className="w-full h-32 border rounded-lg p-3 text-sm"
        placeholder="Pega aquí información sobre tus productos y servicios..."
      />
      <button onClick={onComplete} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
        Guardar y Continuar
      </button>
    </div>
  );
}

function ScoringStep({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Define los criterios para calificar un lead.</p>
      <label className="block text-sm">
        Umbral de calificación (1-99):
        <input type="number" min={1} max={99} defaultValue={60} className="ml-2 border rounded px-2 py-1 w-16" />
      </label>
      <button onClick={onComplete} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
        Guardar y Continuar
      </button>
    </div>
  );
}

function CalendarStep({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Conecta tu Google Calendar para agendar citas automáticamente.</p>
      <button className="w-full p-4 border rounded-lg text-left hover:bg-gray-50">
        📅 Conectar Google Calendar
      </button>
      <button onClick={onComplete} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
        Finalizar Configuración
      </button>
    </div>
  );
}

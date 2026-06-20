/**
 * Página de Calendario/Citas.
 * Requisito: 5.1
 */

"use client";

import { useEffect, useState } from "react";

interface Appointment {
  id: string;
  leadName: string;
  startTime: string;
  endTime: string;
  status: string;
}

export default function CalendarPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/appointments")
      .then((r) => r.json())
      .then((data) => setAppointments(data.data || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-500">Cargando citas...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Citas Agendadas</h1>
      <div className="space-y-3">
        {appointments.map((apt) => (
          <div key={apt.id} className="bg-white rounded-xl border p-4 flex justify-between items-center">
            <div>
              <p className="font-medium">{apt.leadName}</p>
              <p className="text-sm text-gray-500">
                {new Date(apt.startTime).toLocaleString()} — {new Date(apt.endTime).toLocaleTimeString()}
              </p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${
              apt.status === "confirmed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
            }`}>
              {apt.status}
            </span>
          </div>
        ))}
        {appointments.length === 0 && (
          <p className="text-center text-gray-400 py-8">No hay citas programadas.</p>
        )}
      </div>
    </div>
  );
}

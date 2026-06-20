/**
 * Página de Leads — Lista y detalle de leads.
 * Requisitos: 7.1, 1.4
 */

"use client";

import { useEffect, useState } from "react";

interface Lead {
  id: string;
  name: string;
  score: number;
  status: string;
  preferredChannel: string;
  lastMessageAt: string | null;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leads")
      .then((r) => r.json())
      .then((data) => setLeads(data.data || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-500">Cargando leads...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Leads</h1>
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">Nombre</th>
              <th className="text-left p-3">Score</th>
              <th className="text-left p-3">Estado</th>
              <th className="text-left p-3">Canal</th>
              <th className="text-left p-3">Última Actividad</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{lead.name || "Sin nombre"}</td>
                <td className="p-3">
                  <span className={`font-bold ${lead.score >= 60 ? "text-green-600" : "text-gray-500"}`}>
                    {lead.score}
                  </span>
                </td>
                <td className="p-3 capitalize">{lead.status}</td>
                <td className="p-3">{lead.preferredChannel || "-"}</td>
                <td className="p-3 text-gray-500">
                  {lead.lastMessageAt ? new Date(lead.lastMessageAt).toLocaleDateString() : "-"}
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-400">
                  No hay leads aún.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

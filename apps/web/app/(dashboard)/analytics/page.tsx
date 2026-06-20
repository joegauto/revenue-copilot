/**
 * Dashboard de métricas comerciales.
 *
 * Muestra KPIs, embudo de conversión y métricas de rendimiento.
 *
 * Requisitos: 7.1, 7.2, 7.3, 7.7
 */

"use client";

import { useEffect, useState } from "react";

interface Metrics {
  kpis: {
    leadsActivos: number;
    leadsCalificados: number;
    citasAgendadas: number;
    conversacionesActivas: number;
    tasaConversion: number;
    scorePromedio: number;
  };
}

interface FunnelStage {
  stage: string;
  count: number;
  rate: number;
}

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [metricsRes, funnelRes] = await Promise.all([
          fetch(`/api/metrics?days=${days}`),
          fetch(`/api/metrics/funnel?days=${days}`),
        ]);
        const metricsData = await metricsRes.json();
        const funnelData = await funnelRes.json();
        setMetrics(metricsData.data);
        setFunnel(funnelData.data?.funnel || []);
      } catch {
        // Estado vacío
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [days]);

  if (loading) {
    return <div className="p-8 text-gray-500">Cargando métricas...</div>;
  }

  if (!metrics) {
    return (
      <div className="p-8 text-center text-gray-400">
        <p className="text-lg">Sin datos para el período seleccionado</p>
        <p className="text-sm mt-2">Los datos aparecerán cuando se generen conversaciones.</p>
      </div>
    );
  }

  const { kpis } = metrics;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header + Date Range */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Métricas Comerciales</h1>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value={7}>7 días</option>
          <option value={30}>30 días</option>
          <option value={90}>90 días</option>
          <option value={365}>1 año</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Leads Activos" value={kpis.leadsActivos} />
        <KpiCard label="Calificados" value={kpis.leadsCalificados} />
        <KpiCard label="Citas" value={kpis.citasAgendadas} />
        <KpiCard label="Conversaciones" value={kpis.conversacionesActivas} />
        <KpiCard label="Conversión" value={`${kpis.tasaConversion}%`} />
        <KpiCard label="Score Prom." value={kpis.scorePromedio} />
      </div>

      {/* Funnel */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">Embudo de Conversión</h2>
        <div className="space-y-3">
          {funnel.map((stage) => (
            <div key={stage.stage} className="flex items-center gap-3">
              <span className="w-28 text-sm text-gray-600 capitalize">
                {stage.stage.replace("_", " ")}
              </span>
              <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                <div
                  className="bg-indigo-500 h-full rounded-full transition-all"
                  style={{ width: `${stage.rate}%` }}
                />
              </div>
              <span className="text-sm font-medium w-16 text-right">
                {stage.count} ({stage.rate}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

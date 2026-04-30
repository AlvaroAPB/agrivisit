import { useState } from "react";
import { trpc } from "../lib/trpc";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart, Area, AreaChart, ReferenceLine
} from "recharts";
import { TableIcon, BarChart3, LineChart as LineChartIcon, AlertTriangle, ThermometerSun, Snowflake, Droplets, Loader2 } from "lucide-react";
import { format } from "date-fns";

type ViewMode = "graph" | "table";
type ChartType = "monthly" | "chill" | "gdd" | "temperature";

interface Props {
  farmId: number;
  requerimientoFrio?: number; // CP necesarios
  variedad?: string;
}

function getDefaultDates() {
  const today = new Date();
  // Por defecto: período de acumulación de frío (1 oct año anterior - 1 mar año actual)
  const year = today.getFullYear();
  const month = today.getMonth();
  const startYear = month >= 9 ? year : year - 1;
  return {
    start: `${startYear}-10-01`,
    end: `${startYear + 1}-03-31`,
  };
}

const MESES_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function PestanaClima({ farmId, requerimientoFrio, variedad }: Props) {
  const defaults = getDefaultDates();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [view, setView] = useState<ViewMode>("graph");
  const [chartType, setChartType] = useState<ChartType>("chill");

  const { data, isLoading, error } = trpc.climate.getFarmClimate.useQuery(
    { farmId, startDate, endDate },
    { staleTime: 30 * 60 * 1000, refetchOnWindowFocus: false }
  );

  if (isLoading) return (
    <div className="bg-white rounded-xl border border-gray-100 p-12 flex flex-col items-center justify-center text-center">
      <Loader2 className="w-8 h-8 text-green-500 animate-spin mb-3" />
      <p className="text-sm text-gray-500">Cargando datos climáticos de Open-Meteo...</p>
      <p className="text-xs text-gray-400 mt-1">Calculando Chill Portions, GDD y estadísticas mensuales</p>
    </div>
  );

  if (error) return (
    <div className="bg-red-50 rounded-xl border border-red-200 p-6">
      <div className="flex items-center gap-2 text-red-700">
        <AlertTriangle className="w-5 h-5" />
        <p className="text-sm font-medium">Error al cargar datos climáticos</p>
      </div>
      <p className="text-xs text-red-600 mt-1">{error.message}</p>
    </div>
  );

  if (!data) return null;

  // Datos para gráficos
  const monthlyData = data.monthlyStats.map(m => {
    const [year, mon] = m.month.split("-");
    return {
      month: `${MESES_ES[parseInt(mon) - 1]} ${year.slice(-2)}`,
      tmean: m.tmean,
      tmin: m.tmin,
      tmax: m.tmax,
      precipitation: m.precipitation,
      frostDays: m.daysFrost,
      hotDays: m.daysHot,
    };
  });

  const chillData = data.chillEvolution.map((d, i) => ({
    date: d.date,
    portions: d.cumulative,
    hours: data.chillHoursEvolution[i]?.cumulative ?? 0,
    objetivo: requerimientoFrio ?? null,
  }));

  const gddData = data.gddEvolution.map(d => ({
    date: d.date,
    daily: d.daily,
    cumulative: d.cumulative,
  }));

  const cpProgress = requerimientoFrio ? Math.min(100, (data.chillPortions / requerimientoFrio) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Snowflake className="w-4 h-4" />}
          label="Chill Portions (Dynamic)"
          value={data.chillPortions.toFixed(1)}
          sub={requerimientoFrio ? `de ${requerimientoFrio} requeridos (${cpProgress.toFixed(0)}%)` : "Modelo Fishman"}
          color={requerimientoFrio
            ? cpProgress >= 100 ? "green" : cpProgress >= 70 ? "amber" : "red"
            : "blue"}
        />
        <KpiCard
          icon={<Snowflake className="w-4 h-4" />}
          label="Horas frío (<7.2°C)"
          value={data.chillHours.toString()}
          sub="Modelo clásico"
          color="blue"
        />
        <KpiCard
          icon={<ThermometerSun className="w-4 h-4" />}
          label="T media período"
          value={`${monthlyData.length > 0 ? (monthlyData.reduce((a, b) => a + b.tmean, 0) / monthlyData.length).toFixed(1) : "—"}°C`}
          sub={`Mín: ${data.frostRisk.minTemp.toFixed(1)}°C`}
          color={data.frostRisk.minTemp < 0 ? "amber" : "green"}
        />
        <KpiCard
          icon={<Droplets className="w-4 h-4" />}
          label="Precipitación total"
          value={`${monthlyData.reduce((a, b) => a + b.precipitation, 0).toFixed(0)}mm`}
          sub={`${data.frostRisk.totalFrostDays} días con helada`}
          color="blue"
        />
      </div>

      {/* Controles */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Desde</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Hasta</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1 text-sm" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setView("graph")}
                className={`px-3 py-1.5 text-xs rounded-md flex items-center gap-1 ${view === "graph" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
                <BarChart3 className="w-3 h-3" /> Gráfico
              </button>
              <button onClick={() => setView("table")}
                className={`px-3 py-1.5 text-xs rounded-md flex items-center gap-1 ${view === "table" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
                <TableIcon className="w-3 h-3" /> Tabla
              </button>
            </div>
          </div>
        </div>

        {view === "graph" && (
          <div className="flex flex-wrap gap-2 mt-3">
            {[
              { key: "chill", label: "Acumulación de frío" },
              { key: "monthly", label: "Resumen mensual" },
              { key: "temperature", label: "Temperaturas" },
              { key: "gdd", label: "Grados-día (GDD)" },
            ].map(t => (
              <button key={t.key} onClick={() => setChartType(t.key as ChartType)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  chartType === t.key ? "bg-green-50 text-green-700 border-green-200" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Visualización */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        {view === "graph" && chartType === "chill" && (
          <>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Acumulación de frío — Dynamic Model</h3>
            <p className="text-xs text-gray-500 mb-4">Chill Portions acumuladas día a día. {requerimientoFrio ? `Línea roja = objetivo (${requerimientoFrio} CP).` : "Sin objetivo definido — añade el requerimiento de frío en la ficha."}</p>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chillData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => format(new Date(d), "dd MMM")} />
                <YAxis tick={{ fontSize: 11 }} label={{ value: "Chill Portions", angle: -90, position: "insideLeft", fontSize: 11 }} />
                <Tooltip labelFormatter={d => format(new Date(d as string), "dd MMM yyyy")} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="portions" stroke="#16a34a" fill="#16a34a" fillOpacity={0.2} name="Chill Portions" />
                {requerimientoFrio && <ReferenceLine y={requerimientoFrio} stroke="#dc2626" strokeDasharray="5 5" label={{ value: `Objetivo: ${requerimientoFrio} CP`, position: "right", fontSize: 11, fill: "#dc2626" }} />}
              </AreaChart>
            </ResponsiveContainer>
          </>
        )}

        {view === "graph" && chartType === "monthly" && (
          <>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Resumen mensual</h3>
            <p className="text-xs text-gray-500 mb-4">Temperaturas medias y precipitación por mes</p>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: "°C", angle: -90, position: "insideLeft", fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} label={{ value: "mm", angle: 90, position: "insideRight", fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="right" dataKey="precipitation" fill="#3b82f6" name="Precipitación (mm)" />
                <Line yAxisId="left" type="monotone" dataKey="tmean" stroke="#16a34a" strokeWidth={2} name="T media" />
                <Line yAxisId="left" type="monotone" dataKey="tmax" stroke="#f97316" strokeWidth={2} name="T máx" strokeDasharray="3 3" />
                <Line yAxisId="left" type="monotone" dataKey="tmin" stroke="#0ea5e9" strokeWidth={2} name="T mín" strokeDasharray="3 3" />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        )}

        {view === "graph" && chartType === "temperature" && (
          <>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Temperaturas por mes</h3>
            <p className="text-xs text-gray-500 mb-4">T máxima, media y mínima absolutas del mes</p>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} label={{ value: "°C", angle: -90, position: "insideLeft", fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="tmax" fill="#f97316" name="T máx" />
                <Bar dataKey="tmean" fill="#16a34a" name="T media" />
                <Bar dataKey="tmin" fill="#0ea5e9" name="T mín" />
                <ReferenceLine y={0} stroke="#dc2626" strokeWidth={1} />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}

        {view === "graph" && chartType === "gdd" && (
          <>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Grados-día acumulados (GDD base 10°C)</h3>
            <p className="text-xs text-gray-500 mb-4">Útil para predecir fenofases post-floración hasta cosecha</p>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={gddData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => format(new Date(d), "dd MMM")} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={d => format(new Date(d as string), "dd MMM yyyy")} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="cumulative" stroke="#dc2626" strokeWidth={2} name="GDD acumulados" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}

        {view === "table" && (
          <>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Resumen mensual — vista tabla</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-3 py-2">Mes</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase px-3 py-2">T media</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase px-3 py-2">T mín</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase px-3 py-2">T máx</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase px-3 py-2">Precip.</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase px-3 py-2">Días helada</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase px-3 py-2">Días &gt;35°C</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((m, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900">{m.month}</td>
                      <td className="px-3 py-2 text-right">{m.tmean}°C</td>
                      <td className={`px-3 py-2 text-right ${m.tmin < 0 ? "text-blue-600 font-medium" : ""}`}>{m.tmin}°C</td>
                      <td className={`px-3 py-2 text-right ${m.tmax > 35 ? "text-orange-600 font-medium" : ""}`}>{m.tmax}°C</td>
                      <td className="px-3 py-2 text-right">{m.precipitation}mm</td>
                      <td className="px-3 py-2 text-right">{m.frostDays > 0 ? <span className="text-blue-600">{m.frostDays}</span> : "—"}</td>
                      <td className="px-3 py-2 text-right">{m.hotDays > 0 ? <span className="text-orange-600">{m.hotDays}</span> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-gray-400 px-1">
        {data.dataSource && (
          <>
            <strong>Fuente:</strong> {data.dataSource.model} · Punto de grid: {data.dataSource.gridLat.toFixed(4)}, {data.dataSource.gridLng.toFixed(4)} ({data.dataSource.distanceKm.toFixed(1)} km de la finca) · Elevación modelo: {data.dataSource.elevation}m
            <br />
          </>
        )}
        Datos de <a href="https://open-meteo.com" target="_blank" rel="noreferrer" className="underline">Open-Meteo</a> · Modelo de frío: Dynamic Model (Fishman et al., 1987) · GDD base 10°C
      </p>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub: string; color: "green" | "blue" | "amber" | "red" }) {
  const colors = {
    green: "bg-green-50 text-green-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full mb-2 ${colors[color]}`}>
        {icon} {label}
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
    </div>
  );
}

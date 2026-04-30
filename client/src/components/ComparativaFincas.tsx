import { useState, useEffect } from "react";
import { trpc } from "../lib/trpc";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { Loader2, BarChart3 } from "lucide-react";
import { format } from "date-fns";

const COLORS = ["#16a34a", "#3b82f6", "#f97316", "#a855f7", "#ec4899", "#0891b2"];
const MESES_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

type ChartType = "chill" | "tmean" | "precipitation" | "tmin";

interface FarmData {
  farmId: number;
  farmName: string;
  data: any;
}

export default function ComparativaFincas() {
  const today = new Date();
  const month = today.getMonth();
  const year = today.getFullYear();
  const startYear = month >= 9 ? year : year - 1;
  const [startDate, setStartDate] = useState(`${startYear}-10-01`);
  const [endDate, setEndDate] = useState(`${startYear + 1}-03-31`);
  const [chartType, setChartType] = useState<ChartType>("chill");

  const { data: farms = [] } = trpc.farms.list.useQuery();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [farmData, setFarmData] = useState<FarmData[]>([]);
  const [loading, setLoading] = useState(false);

  const utils = trpc.useUtils();

  const toggleFarm = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 6) next.add(id);
      return next;
    });
  };

  // Cargar datos cuando cambia la selección o las fechas
  useEffect(() => {
    const farmIds = Array.from(selected);
    if (farmIds.length === 0) {
      setFarmData([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all(
      farmIds.map(async (id) => {
        try {
          const data = await utils.climate.getFarmClimate.fetch({ farmId: id, startDate, endDate });
          const farm = farms.find(f => f.id === id);
          return { farmId: id, farmName: farm?.name || `Finca ${id}`, data };
        } catch (e) {
          return null;
        }
      })
    ).then(results => {
      if (cancelled) return;
      setFarmData(results.filter((r): r is FarmData => r !== null));
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [selected, startDate, endDate, farms]);

  // Construir datos para el gráfico según tipo
  const buildChartData = () => {
    if (farmData.length === 0) return [];

    if (chartType === "chill") {
      const allDates = new Set<string>();
      farmData.forEach(d => d.data.chillEvolution.forEach((e: any) => allDates.add(e.date)));
      const sortedDates = Array.from(allDates).sort();

      return sortedDates.map(date => {
        const row: any = { date };
        farmData.forEach(d => {
          const point = d.data.chillEvolution.find((e: any) => e.date === date);
          row[d.farmName] = point?.cumulative ?? null;
        });
        return row;
      });
    }

    const allMonths = new Set<string>();
    farmData.forEach(d => d.data.monthlyStats.forEach((m: any) => allMonths.add(m.month)));
    const sortedMonths = Array.from(allMonths).sort();

    return sortedMonths.map(month => {
      const [yyyy, mm] = month.split("-");
      const label = `${MESES_ES[parseInt(mm) - 1]} ${yyyy.slice(-2)}`;
      const row: any = { month: label };
      farmData.forEach(d => {
        const stat = d.data.monthlyStats.find((m: any) => m.month === month);
        if (chartType === "tmean") row[d.farmName] = stat?.tmean ?? null;
        else if (chartType === "tmin") row[d.farmName] = stat?.tmin ?? null;
        else row[d.farmName] = stat?.precipitation ?? null;
      });
      return row;
    });
  };

  const chartData = buildChartData();

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Selecciona fincas para comparar</h3>
            <p className="text-xs text-gray-500 mt-0.5">{selected.size} de 6 máximo seleccionadas</p>
          </div>
          {selected.size > 0 && (
            <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:text-gray-700">
              Quitar todas
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {farms.map(farm => {
            const isSelected = selected.has(farm.id);
            const idx = Array.from(selected).indexOf(farm.id);
            const color = isSelected ? COLORS[idx % COLORS.length] : "#e5e7eb";
            let extra: any = {};
            try { extra = JSON.parse(farm.description || "{}"); } catch {}
            return (
              <button key={farm.id} onClick={() => toggleFarm(farm.id)}
                disabled={!isSelected && selected.size >= 6}
                className={`text-sm px-3 py-2 rounded-lg border-2 transition-all flex items-center gap-2 ${
                  isSelected ? "bg-white shadow-sm" : "bg-gray-50 hover:bg-gray-100 border-transparent text-gray-600"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
                style={isSelected ? { borderColor: color } : {}}>
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                {farm.name}
                {extra.especie && <span className="text-xs text-gray-500">· {extra.especie}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {selected.size > 0 && (
        <>
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
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {[
                { key: "chill", label: "Chill Portions acumulados" },
                { key: "tmean", label: "Temperatura media" },
                { key: "tmin", label: "Temperatura mínima" },
                { key: "precipitation", label: "Precipitación" },
              ].map(t => (
                <button key={t.key} onClick={() => setChartType(t.key as ChartType)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    chartType === t.key ? "bg-green-50 text-green-700 border-green-200" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-green-500 animate-spin mb-2" />
                <p className="text-sm text-gray-500">Cargando datos de las fincas seleccionadas...</p>
              </div>
            ) : chartData.length === 0 ? (
              <p className="text-center text-gray-400 py-12">No hay datos para mostrar</p>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  {chartType === "chill" && "Acumulación de Chill Portions"}
                  {chartType === "tmean" && "Temperatura media mensual"}
                  {chartType === "tmin" && "Temperatura mínima mensual"}
                  {chartType === "precipitation" && "Precipitación mensual"}
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Comparativa entre {selected.size} fincas · {format(new Date(startDate), "dd MMM yyyy")} – {format(new Date(endDate), "dd MMM yyyy")}
                </p>
                <ResponsiveContainer width="100%" height={380}>
                  {chartType === "precipitation" ? (
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} label={{ value: "mm", angle: -90, position: "insideLeft", fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {farmData.map((d, i) => (
                        <Bar key={d.farmId} dataKey={d.farmName} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </BarChart>
                  ) : (
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey={chartType === "chill" ? "date" : "month"} tick={{ fontSize: 11 }}
                        tickFormatter={chartType === "chill" ? (d) => format(new Date(d), "dd MMM") : undefined} />
                      <YAxis tick={{ fontSize: 11 }}
                        label={{ value: chartType === "chill" ? "CP" : "°C", angle: -90, position: "insideLeft", fontSize: 11 }} />
                      <Tooltip labelFormatter={chartType === "chill" ? (d) => format(new Date(d as string), "dd MMM yyyy") : undefined} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {farmData.map((d, i) => (
                        <Line key={d.farmId}
                          type="monotone"
                          dataKey={d.farmName}
                          stroke={COLORS[i % COLORS.length]}
                          strokeWidth={2}
                          dot={false} />
                      ))}
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </>
            )}
          </div>

          {!loading && farmData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Resumen del período</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-2">Finca</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-2">CP totales</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-2">Horas frío</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-2">T media</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-2">T mínima</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-2">Precip.</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-2">Heladas</th>
                  </tr>
                </thead>
                <tbody>
                  {farmData.map((d, i) => {
                    const tmean = d.data.monthlyStats.length > 0
                      ? d.data.monthlyStats.reduce((a: number, b: any) => a + b.tmean, 0) / d.data.monthlyStats.length
                      : 0;
                    const precip = d.data.monthlyStats.reduce((a: number, b: any) => a + b.precipitation, 0);
                    return (
                      <tr key={d.farmId} className="border-b border-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-900 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          {d.farmName}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">{d.data.chillPortions.toFixed(1)}</td>
                        <td className="px-4 py-2 text-right">{d.data.chillHours}</td>
                        <td className="px-4 py-2 text-right">{tmean.toFixed(1)}°C</td>
                        <td className="px-4 py-2 text-right">{d.data.frostRisk.minTemp.toFixed(1)}°C</td>
                        <td className="px-4 py-2 text-right">{precip.toFixed(0)}mm</td>
                        <td className="px-4 py-2 text-right">{d.data.frostRisk.totalFrostDays}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {selected.size === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">Selecciona al menos una finca para comparar</p>
        </div>
      )}
    </div>
  );
}

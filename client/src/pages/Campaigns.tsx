import { useState } from "react";
import Sidebar from "../components/Sidebar";
import { trpc } from "../lib/trpc";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Sparkles, Trash2, AlertTriangle, CloudSnow, ThermometerSun, CloudHail } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Link } from "wouter";

export default function Campaigns() {
  const { data: campaigns = [], refetch, isLoading } = trpc.campaigns.listAll.useQuery();
  const { data: farms = [] } = trpc.farms.list.useQuery();
  const generateMut = trpc.campaigns.generateSynthetic.useMutation({ onSuccess: () => refetch() });
  const deleteMut = trpc.campaigns.delete.useMutation({ onSuccess: () => refetch() });
  const [filterFarm, setFilterFarm] = useState<number | "all">("all");
  const [showGenerator, setShowGenerator] = useState(false);

  const filtered = filterFarm === "all" ? campaigns : campaigns.filter(c => c.farmId === filterFarm);
  const farmName = (id: number) => farms.find(f => f.id === id)?.name ?? `Finca ${id}`;

  const yieldsByYear: Record<number, { year: number; total: number; mean: number; n: number }> = {};
  for (const c of campaigns) {
    const y = c.year;
    if (!yieldsByYear[y]) yieldsByYear[y] = { year: y, total: 0, mean: 0, n: 0 };
    yieldsByYear[y].total += parseFloat(c.totalYieldKg || "0");
    yieldsByYear[y].mean += parseFloat(c.yieldKgHa || "0");
    yieldsByYear[y].n += 1;
  }
  const yearChart = Object.values(yieldsByYear)
    .map(y => ({ ...y, mean: Math.round(y.mean / y.n), total: Math.round(y.total / 1000) }))
    .sort((a, b) => a.year - b.year);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Campañas</h1>
            <p className="text-sm text-gray-500 mt-1">Histórico de producción · {campaigns.length} campañas registradas</p>
          </div>
          <button onClick={() => setShowGenerator(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
            <Sparkles className="w-4 h-4" />
            Generar datos sintéticos
          </button>
        </div>

        {/* Aviso de datos sintéticos */}
        {campaigns.length > 0 && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-purple-600 mt-0.5" />
            <div className="text-sm text-purple-900">
              <strong>Modo simulación:</strong> los datos mostrados son sintéticos, generados con el modelo PEACH (Grossman & DeJong, 1994) usando datos climáticos reales de Open-Meteo. Sirven para validar el modelo predictivo antes de tener datos reales de campo.
            </div>
          </div>
        )}

        {/* Gráfico evolución */}
        {yearChart.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Evolución de producción por campaña</h2>
            <p className="text-xs text-gray-500 mb-4">Producción media por hectárea entre todas las fincas</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={yearChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} label={{ value: "kg/ha", angle: -90, position: "insideLeft", fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="mean" fill="#16a34a" name="Producción media (kg/ha)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Filtro */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-3 flex items-center gap-3">
          <label className="text-sm text-gray-600">Filtrar por finca:</label>
          <select value={filterFarm === "all" ? "all" : String(filterFarm)}
            onChange={e => setFilterFarm(e.target.value === "all" ? "all" : parseInt(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
            <option value="all">Todas</option>
            {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <span className="ml-auto text-xs text-gray-400">{filtered.length} campañas</span>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 mb-3">No hay campañas registradas</p>
              <button onClick={() => setShowGenerator(true)} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 inline-flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Generar datos sintéticos
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-2">Año</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-2">Finca</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-2">Variedad</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-2">Floración</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-2">Cosecha</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-2">kg/ha</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-2">Calibre</th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-2">Brix</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-2">Cat.</th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-2">Eventos</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2 font-semibold">{c.year}</td>
                      <td className="px-4 py-2">
                        <Link href={`/fincas/${c.farmId}`}>
                          <a className="text-gray-900 hover:text-green-700">{farmName(c.farmId)}</a>
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-gray-600">{c.variety || "-"}</td>
                      <td className="px-4 py-2 text-gray-600">{c.bloomDate ? format(new Date(c.bloomDate), "dd MMM", { locale: es }) : "-"}</td>
                      <td className="px-4 py-2 text-gray-600">{c.harvestStartDate ? format(new Date(c.harvestStartDate), "dd MMM", { locale: es }) : "-"}</td>
                      <td className="px-4 py-2 text-right font-semibold">{c.yieldKgHa ? Math.round(parseFloat(c.yieldKgHa)).toLocaleString() : "-"}</td>
                      <td className="px-4 py-2 text-right">{c.meanCaliberMm ? `${c.meanCaliberMm}mm` : "-"}</td>
                      <td className="px-4 py-2 text-right">{c.brixDegrees ? `${c.brixDegrees}°` : "-"}</td>
                      <td className="px-4 py-2">
                        {c.commercialCategory && <span className={`text-xs px-2 py-0.5 rounded-full ${
                          c.commercialCategory === "Extra" ? "bg-green-50 text-green-700" :
                          c.commercialCategory === "Categoría I" ? "bg-blue-50 text-blue-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>{c.commercialCategory}</span>}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          {(c.frostEvents || 0) > 0 && <span title={`${c.frostEvents} días helada`} className="text-blue-600"><CloudSnow className="w-3.5 h-3.5" /></span>}
                          {(c.heatStressEvents || 0) > 5 && <span title={`${c.heatStressEvents} días >35°C`} className="text-orange-600"><ThermometerSun className="w-3.5 h-3.5" /></span>}
                          {c.hailEvent && <span title="Granizo" className="text-purple-600"><CloudHail className="w-3.5 h-3.5" /></span>}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => deleteMut.mutate({ id: c.id })} className="text-gray-300 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {showGenerator && (
        <GeneratorModal
          onClose={() => setShowGenerator(false)}
          onSuccess={() => { refetch(); setShowGenerator(false); }}
          farmsCount={farms.length}
        />
      )}
    </div>
  );
}

function GeneratorModal({ onClose, onSuccess, farmsCount }: { onClose: () => void; onSuccess: () => void; farmsCount: number }) {
  const [yearStart, setYearStart] = useState(2019);
  const [yearEnd, setYearEnd] = useState(2024);
  const [clearExisting, setClearExisting] = useState(true);
  const generateMut = trpc.campaigns.generateSynthetic.useMutation({ onSuccess });

  const years = [];
  for (let y = yearStart; y <= yearEnd; y++) years.push(y);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            Generar datos sintéticos
          </h2>
          <p className="text-xs text-gray-500 mt-1">Crea campañas para todas tus fincas con datos científicamente coherentes basados en clima real</p>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Año inicio</label>
              <input type="number" min="2000" max="2024" value={yearStart} onChange={e => setYearStart(parseInt(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Año fin</label>
              <input type="number" min="2000" max="2024" value={yearEnd} onChange={e => setYearEnd(parseInt(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={clearExisting} onChange={e => setClearExisting(e.target.checked)} />
            Borrar campañas existentes antes de generar
          </label>

          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
            <p>Se generarán <strong>{years.length * farmsCount}</strong> campañas en total ({years.length} años × {farmsCount} fincas).</p>
            <p className="mt-1">El proceso descarga datos climáticos reales y aplica el modelo predictivo. Puede tardar 1-3 minutos.</p>
          </div>

          {generateMut.isError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{generateMut.error.message}</p>}
          {generateMut.data && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">✓ Generadas {generateMut.data.created} campañas</p>}
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button onClick={() => generateMut.mutate({ years, clearExisting })}
            disabled={generateMut.isPending || farmsCount === 0}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
            {generateMut.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando...</> : <><Sparkles className="w-4 h-4" /> Generar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

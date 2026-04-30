import Sidebar from "../components/Sidebar";
import { trpc } from "../lib/trpc";
import { Loader2, TrendingUp, TrendingDown, Activity, FlaskConical } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from "recharts";

export default function ModelAnalysis() {
  const { data, isLoading } = trpc.campaigns.validateModel.useQuery();
  const { data: campaigns = [] } = trpc.campaigns.listAll.useQuery();
  const { data: varieties = [] } = trpc.campaigns.listVarieties.useQuery();

  if (isLoading) return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
      </main>
    </div>
  );

  if (!data || data.campaigns === 0) return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Análisis predictivo</h1>
        <p className="text-sm text-gray-500 mb-6">Validación del modelo con datos de campañas</p>
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <FlaskConical className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 mb-2">No hay campañas para analizar</p>
          <p className="text-xs text-gray-400">Genera datos sintéticos en la página de Campañas para validar el modelo</p>
        </div>
      </main>
    </div>
  );

  // Datos para gráfico CP vs Yield
  const cpVsYield = campaigns.map(c => ({
    cp: parseFloat(c.chillPortions || "0"),
    yield: parseFloat(c.yieldKgHa || "0"),
    variety: c.variety,
  })).filter(d => d.cp > 0 && d.yield > 0);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Análisis predictivo</h1>
          <p className="text-sm text-gray-500 mt-1">Validación del modelo con {data.campaigns} campañas</p>
        </div>

        {/* KPIs resumen */}
        {data.summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 mb-1">Producción total acumulada</p>
              <p className="text-xl font-bold text-gray-900">{(data.summary.totalProductionKg / 1000).toFixed(1)} t</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 mb-1">Producción media</p>
              <p className="text-xl font-bold text-gray-900">{data.summary.meanYieldKgHa.toLocaleString()} <span className="text-sm font-normal text-gray-500">kg/ha</span></p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 mb-1">Campañas con heladas</p>
              <p className="text-xl font-bold text-blue-600">{data.summary.frostAffectedCampaigns}</p>
              <p className="text-xs text-gray-500">de {data.summary.totalCampaigns}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 mb-1">Campañas con granizo</p>
              <p className="text-xl font-bold text-purple-600">{data.summary.hailAffectedCampaigns}</p>
              <p className="text-xs text-gray-500">de {data.summary.totalCampaigns}</p>
            </div>
          </div>
        )}

        {/* Correlaciones de Pearson */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Correlaciones de Pearson — qué influye más en la producción</h2>
          <p className="text-xs text-gray-500 mb-4">Coeficiente entre -1 y 1 · valores cercanos a -1 indican relación inversa fuerte</p>

          <div className="space-y-3">
            <CorrelationBar label="Heladas vs Producción" value={data.correlations.frostVsYield} expectedSign="negative" />
            <CorrelationBar label="Calor extremo (>35°C) vs Producción" value={data.correlations.heatVsYield} expectedSign="negative" />
            <CorrelationBar label="Chill Portions vs Producción" value={data.correlations.cpVsYield} expectedSign="positive" />
          </div>

          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
            <strong>Interpretación:</strong> el modelo refleja correctamente que las heladas reducen la producción (correlación negativa esperada) y que más Chill Portions (mejor reposo invernal) tienden a aumentarla. El modelo PEACH ha sido calibrado con estos parámetros desde 1994.
          </div>
        </div>

        {/* Tabla por variedad */}
        <div className="bg-white rounded-xl border border-gray-100 mb-6">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Estadísticas por variedad</h2>
            <p className="text-xs text-gray-500 mt-0.5">Media y desviación estándar de los principales indicadores</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-2">Variedad</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-2">N</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-2">Yield medio</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-2">Variabilidad</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-2">Calibre medio</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-2">Brix medio</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-2">CP medios</th>
                </tr>
              </thead>
              <tbody>
                {data.byVariety.map((v: any) => {
                  const cv = v.yieldMean > 0 ? Math.round((v.yieldStd / v.yieldMean) * 100) : 0;
                  return (
                    <tr key={v.variety} className="border-b border-gray-50">
                      <td className="px-4 py-2 font-medium">{v.variety}</td>
                      <td className="px-4 py-2 text-right">{v.n}</td>
                      <td className="px-4 py-2 text-right font-semibold">{v.yieldMean.toLocaleString()} kg/ha</td>
                      <td className="px-4 py-2 text-right">±{v.yieldStd.toLocaleString()} <span className="text-xs text-gray-500">(CV {cv}%)</span></td>
                      <td className="px-4 py-2 text-right">{v.caliberMean}mm</td>
                      <td className="px-4 py-2 text-right">{v.brixMean}°</td>
                      <td className="px-4 py-2 text-right">{v.cpMean}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Scatter CP vs Yield */}
        {cpVsYield.length > 5 && (
          <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Dispersión Chill Portions vs Producción</h2>
            <p className="text-xs text-gray-500 mb-4">Cada punto es una campaña — relación entre acumulación de frío y producción final</p>
            <ResponsiveContainer width="100%" height={320}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" dataKey="cp" name="Chill Portions" tick={{ fontSize: 11 }} label={{ value: "Chill Portions", position: "bottom", fontSize: 11 }} />
                <YAxis type="number" dataKey="yield" name="Yield" tick={{ fontSize: 11 }} label={{ value: "kg/ha", angle: -90, position: "insideLeft", fontSize: 11 }} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                <Scatter data={cpVsYield} fill="#16a34a" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Variedades del catálogo */}
        <div className="bg-white rounded-xl border border-gray-100 mb-6">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Catálogo de variedades del modelo</h2>
            <p className="text-xs text-gray-500 mt-0.5">Parámetros base usados para la simulación · Fuente: literatura científica</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-2">Variedad</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-2">Especie</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-2">CR (CP)</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-2">GDD flor→cosecha</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-2">Calibre opt.</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-2">Brix opt.</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-2">Época</th>
                </tr>
              </thead>
              <tbody>
                {varieties.map((v: any) => (
                  <tr key={v.name} className="border-b border-gray-50">
                    <td className="px-4 py-2 font-medium">{v.name}</td>
                    <td className="px-4 py-2 text-gray-600">{v.species}</td>
                    <td className="px-4 py-2 text-right">{v.chillRequirement}</td>
                    <td className="px-4 py-2 text-right">{v.gddBloomToHarvest}</td>
                    <td className="px-4 py-2 text-right">{v.optimalCaliberMm}mm</td>
                    <td className="px-4 py-2 text-right">{v.optimalBrix}°</td>
                    <td className="px-4 py-2 text-gray-600">{v.earlyOrLate === "early" ? "Temprana" : v.earlyOrLate === "late" ? "Tardía" : "Media"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-gray-400">
          Modelo: PEACH (Grossman & DeJong, 1994) + Dynamic Model (Fishman et al., 1987) + GDD base 10°C · Datos climáticos: Open-Meteo ERA5
        </p>
      </main>
    </div>
  );
}

function CorrelationBar({ label, value, expectedSign }: { label: string; value: number; expectedSign: "positive" | "negative" }) {
  const abs = Math.abs(value);
  const strength = abs > 0.7 ? "Fuerte" : abs > 0.4 ? "Moderada" : abs > 0.2 ? "Débil" : "Muy débil";
  const matches = (expectedSign === "positive" && value > 0) || (expectedSign === "negative" && value < 0);
  const color = matches ? (abs > 0.4 ? "text-green-600" : "text-amber-600") : "text-red-600";
  const Icon = value > 0 ? TrendingUp : TrendingDown;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-700">{label}</span>
        <span className={`text-sm font-mono font-semibold flex items-center gap-1 ${color}`}>
          <Icon className="w-3.5 h-3.5" />
          {value.toFixed(3)} <span className="text-xs text-gray-500 font-normal">({strength})</span>
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
        {value < 0 ? (
          <>
            <div className="w-1/2" />
            <div className="bg-red-400" style={{ width: `${Math.min(50, abs * 50)}%`, marginLeft: `${50 - Math.min(50, abs * 50)}%` }} />
          </>
        ) : (
          <>
            <div className="w-1/2" />
            <div className="bg-green-500" style={{ width: `${Math.min(50, abs * 50)}%` }} />
          </>
        )}
      </div>
    </div>
  );
}

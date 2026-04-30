import { useState } from "react";
import Sidebar from "../components/Sidebar";
import { trpc } from "../lib/trpc";
import { Leaf, TrendingUp, Thermometer, Droplets, AlertTriangle, CheckCircle2, Calendar, BarChart3, Loader2 } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";

// ─── Variedades de frambuesa para climas semicálidos ─────────────────
const RASPBERRY_VARIETIES = [
  { name: "Autumn Bliss", type: "Remontante", gddBase3: 800, optBrix: 10.5, optCaliberMm: 20, chillHours: 200, cyclesPerYear: 2 },
  { name: "Heritage", type: "Remontante", gddBase3: 850, optBrix: 11.0, optCaliberMm: 21, chillHours: 200, cyclesPerYear: 2 },
  { name: "Polana", type: "Remontante", gddBase3: 780, optBrix: 10.0, optCaliberMm: 19, chillHours: 150, cyclesPerYear: 2 },
  { name: "Kweli", type: "Remontante low-chill", gddBase3: 720, optBrix: 11.5, optCaliberMm: 20, chillHours: 100, cyclesPerYear: 3 },
  { name: "Himbo Top", type: "Remontante", gddBase3: 820, optBrix: 10.8, optCaliberMm: 22, chillHours: 180, cyclesPerYear: 2 },
  { name: "Otra variedad", type: "Remontante", gddBase3: 800, optBrix: 10.5, optCaliberMm: 20, chillHours: 200, cyclesPerYear: 2 },
];

// Fases fenológicas BBCH para frambuesa
const BBCH_PHASES = [
  { code: "09", label: "Yema hinchada", gddStart: 0, gddEnd: 50, color: "#639922" },
  { code: "10-19", label: "Brotación", gddStart: 50, gddEnd: 150, color: "#3B6D11" },
  { code: "51-59", label: "Botón floral", gddStart: 150, gddEnd: 280, color: "#f97316" },
  { code: "60-69", label: "Floración", gddStart: 280, gddEnd: 380, color: "#ef4444" },
  { code: "71-79", label: "Cuajado / Fruto verde", gddStart: 380, gddEnd: 550, color: "#eab308" },
  { code: "81-87", label: "Maduración", gddStart: 550, gddEnd: 750, color: "#dc2626" },
  { code: "89", label: "Cosecha", gddStart: 750, gddEnd: 900, color: "#991b1b" },
];

function getCurrentPhase(gdd: number) {
  return BBCH_PHASES.find(p => gdd >= p.gddStart && gdd < p.gddEnd) ?? BBCH_PHASES[BBCH_PHASES.length - 1];
}

function getWeeksToHarvest(gdd: number, targetGdd: number): number {
  const remaining = Math.max(0, targetGdd - gdd);
  const avgDailyGdd = 8; // promedio en zona semicálida primavera
  return Math.round(remaining / (avgDailyGdd * 7));
}

// Estimación producción frambuesa (kg/ha) por ciclo
function estimateYield(params: {
  density: number; // plantas/ha
  tmeanRipening: number; // T media maduración
  botrytisRisk: boolean;
  variety: typeof RASPBERRY_VARIETIES[0];
}) {
  const baseKgPlant = 1.2; // kg/planta en óptimo
  let yield_ = params.density * baseKgPlant;

  // T óptima maduración: 18-22°C
  if (params.tmeanRipening > 25) yield_ *= 0.85;
  else if (params.tmeanRipening > 28) yield_ *= 0.7;
  else if (params.tmeanRipening < 15) yield_ *= 0.9;

  if (params.botrytisRisk) yield_ *= 0.75;

  return Math.round(yield_);
}

// Riesgo Botrytis: HR>85% + T 15-25°C durante floración
function calcBotrytisRisk(humidity: number, temp: number): "bajo" | "medio" | "alto" {
  if (humidity > 85 && temp >= 15 && temp <= 25) return "alto";
  if (humidity > 75 && temp >= 12 && temp <= 28) return "medio";
  return "bajo";
}

const ic = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";
const sc = ic + " bg-white";

export default function Berries() {
  const { data: farms = [] } = trpc.farms.list.useQuery();

  // Filtrar solo fincas de berries/frambuesa
  const berryFarms = farms.filter(f => {
    try {
      const ex = JSON.parse(f.description || "{}");
      return ["Frambuesa", "Arándano", "Fresa", "Mora", "Grosella", "Otro berry"].includes(ex.especie);
    } catch { return false; }
  });

  const [selectedFarm, setSelectedFarm] = useState<number | null>(berryFarms[0]?.id ?? null);
  const [selectedVariety, setSelectedVariety] = useState(RASPBERRY_VARIETIES[0]);
  const [activeTab, setActiveTab] = useState<"dashboard" | "fenologia" | "produccion">("dashboard");

  // Parámetros manuales (hasta tener datos reales)
  const [gddActual, setGddActual] = useState(320);
  const [tmean, setTmean] = useState(19);
  const [humidity, setHumidity] = useState(72);
  const [cycle, setCycle] = useState<"primavera" | "otono">("primavera");

  const farm = farms.find(f => f.id === selectedFarm);
  let farmExtra: any = {};
  try { farmExtra = JSON.parse(farm?.description || "{}"); } catch {}

  const currentPhase = getCurrentPhase(gddActual);
  const weeksToHarvest = getWeeksToHarvest(gddActual, selectedVariety.gddBase3);
  const botrytisRisk = calcBotrytisRisk(humidity, tmean);
  const yieldEst = estimateYield({
    density: parseFloat(farmExtra.densidad || "2000"),
    tmeanRipening: tmean,
    botrytisRisk: botrytisRisk === "alto",
    variety: selectedVariety,
  });

  // Datos gráfico fenología
  const phenoData = BBCH_PHASES.map(p => ({
    fase: p.label,
    inicio: p.gddStart,
    duracion: p.gddEnd - p.gddStart,
    actual: gddActual >= p.gddStart && gddActual < p.gddEnd,
  }));

  // Datos gráfico GDD acumulados simulados (últimos 90 días)
  const gddEvolution = Array.from({ length: 90 }, (_, i) => ({
    dia: i - 89,
    gdd: Math.round(Math.max(0, gddActual - (89 - i) * 3.5 + (Math.random() - 0.5) * 10)),
  }));

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 bg-red-100 rounded-lg flex items-center justify-center">
                <Leaf className="w-4 h-4 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Berries — Frambuesa</h1>
            </div>
            <p className="text-sm text-gray-500">Módulo de seguimiento fenológico y predicción de cosecha para frambuesa</p>
          </div>
        </div>

        {berryFarms.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <Leaf className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 mb-2">No hay fincas con especie Berry registradas</p>
            <p className="text-xs text-gray-400">Crea una ficha de finca con especie "Frambuesa" para activar este módulo</p>
          </div>
        ) : (
          <>
            {/* Selectores */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Finca:</label>
                <select value={selectedFarm ?? ""} onChange={e => setSelectedFarm(parseInt(e.target.value))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                  {berryFarms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Variedad:</label>
                <select value={selectedVariety.name} onChange={e => setSelectedVariety(RASPBERRY_VARIETIES.find(v => v.name === e.target.value) ?? RASPBERRY_VARIETIES[0])} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                  {RASPBERRY_VARIETIES.map(v => <option key={v.name}>{v.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Ciclo:</label>
                <select value={cycle} onChange={e => setCycle(e.target.value as any)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                  <option value="primavera">Primavera</option>
                  <option value="otono">Otoño (remontante)</option>
                </select>
              </div>
              <div className="ml-auto flex bg-gray-100 rounded-lg p-0.5">
                {(["dashboard", "fenologia", "produccion"] as const).map(t => (
                  <button key={t} onClick={() => setActiveTab(t)}
                    className={`px-3 py-1.5 text-xs rounded-md capitalize ${activeTab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
                    {t === "dashboard" ? "Dashboard" : t === "fenologia" ? "Fenología" : "Producción"}
                  </button>
                ))}
              </div>
            </div>

            {/* KPIs principales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Thermometer className="w-3 h-3" /> GDD acumulados</p>
                <p className="text-2xl font-bold text-gray-900">{gddActual}</p>
                <p className="text-xs text-gray-400 mt-0.5">de {selectedVariety.gddBase3} objetivo · base 3°C</p>
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(100, (gddActual / selectedVariety.gddBase3) * 100)}%` }} />
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Fase actual</p>
                <p className="text-base font-semibold text-gray-900">{currentPhase.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">BBCH {currentPhase.code}</p>
                {weeksToHarvest > 0 && <p className="text-xs text-green-700 mt-1">~{weeksToHarvest} sem. hasta cosecha</p>}
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Producción estimada</p>
                <p className="text-2xl font-bold text-gray-900">{yieldEst.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-0.5">kg/ha · ciclo {cycle}</p>
              </div>
              <div className={`rounded-xl border p-4 ${botrytisRisk === "alto" ? "bg-red-50 border-red-200" : botrytisRisk === "medio" ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
                <p className={`text-xs mb-1 flex items-center gap-1 ${botrytisRisk === "alto" ? "text-red-600" : botrytisRisk === "medio" ? "text-amber-600" : "text-green-700"}`}>
                  <AlertTriangle className="w-3 h-3" /> Riesgo Botrytis
                </p>
                <p className={`text-xl font-bold capitalize ${botrytisRisk === "alto" ? "text-red-700" : botrytisRisk === "medio" ? "text-amber-700" : "text-green-700"}`}>{botrytisRisk}</p>
                <p className={`text-xs mt-0.5 ${botrytisRisk === "alto" ? "text-red-600" : "text-gray-400"}`}>HR: {humidity}% · T: {tmean}°C</p>
              </div>
            </div>

            {/* Panel de parámetros manuales */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
              <p className="text-xs font-medium text-gray-700 mb-3">Parámetros actuales — hasta conectar estación meteorológica</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">GDD acumulados (base 3°C)</label>
                  <input type="range" min="0" max={selectedVariety.gddBase3} value={gddActual} onChange={e => setGddActual(parseInt(e.target.value))} className="w-full" />
                  <p className="text-xs text-gray-600 mt-1">{gddActual} GDD</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">T media actual (°C)</label>
                  <input type="range" min="5" max="35" value={tmean} onChange={e => setTmean(parseInt(e.target.value))} className="w-full" />
                  <p className="text-xs text-gray-600 mt-1">{tmean}°C</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Humedad relativa (%)</label>
                  <input type="range" min="30" max="100" value={humidity} onChange={e => setHumidity(parseInt(e.target.value))} className="w-full" />
                  <p className="text-xs text-gray-600 mt-1">{humidity}%</p>
                </div>
              </div>
            </div>

            {/* Tabs de contenido */}
            {activeTab === "dashboard" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Fases fenológicas BBCH</h3>
                  <div className="space-y-2">
                    {BBCH_PHASES.map(p => {
                      const isActive = gddActual >= p.gddStart && gddActual < p.gddEnd;
                      const isDone = gddActual >= p.gddEnd;
                      return (
                        <div key={p.code} className={`flex items-center gap-3 p-2 rounded-lg ${isActive ? "bg-green-50 border border-green-200" : ""}`}>
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? "bg-green-500" : isDone ? "bg-gray-400" : "bg-gray-200"}`} />
                          <div className="flex-1">
                            <p className={`text-sm ${isActive ? "font-semibold text-green-800" : isDone ? "text-gray-400 line-through" : "text-gray-600"}`}>
                              {p.label}
                            </p>
                            <p className="text-xs text-gray-400">BBCH {p.code} · {p.gddStart}-{p.gddEnd} GDD</p>
                          </div>
                          {isActive && <span className="text-xs text-green-600 font-medium">← Actual</span>}
                          {isDone && <CheckCircle2 className="w-4 h-4 text-gray-300" />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-gray-100 p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Catálogo de variedades</h3>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left text-xs font-medium text-gray-500 uppercase px-2 py-1.5">Variedad</th>
                          <th className="text-right text-xs font-medium text-gray-500 uppercase px-2 py-1.5">GDD</th>
                          <th className="text-right text-xs font-medium text-gray-500 uppercase px-2 py-1.5">Brix</th>
                          <th className="text-right text-xs font-medium text-gray-500 uppercase px-2 py-1.5">Ciclos/año</th>
                        </tr>
                      </thead>
                      <tbody>
                        {RASPBERRY_VARIETIES.filter(v => v.name !== "Otra variedad").map(v => (
                          <tr key={v.name} className={`border-b border-gray-50 ${v.name === selectedVariety.name ? "bg-green-50" : ""}`}>
                            <td className="px-2 py-1.5">
                              <p className="font-medium text-gray-900">{v.name}</p>
                              <p className="text-xs text-gray-500">{v.type}</p>
                            </td>
                            <td className="px-2 py-1.5 text-right">{v.gddBase3}</td>
                            <td className="px-2 py-1.5 text-right">{v.optBrix}°</td>
                            <td className="px-2 py-1.5 text-right">{v.cyclesPerYear}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {botrytisRisk !== "bajo" && (
                    <div className={`rounded-xl border p-4 ${botrytisRisk === "alto" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className={`w-4 h-4 ${botrytisRisk === "alto" ? "text-red-600" : "text-amber-600"}`} />
                        <p className={`text-sm font-semibold ${botrytisRisk === "alto" ? "text-red-800" : "text-amber-800"}`}>
                          Alerta Botrytis cinerea — Riesgo {botrytisRisk}
                        </p>
                      </div>
                      <p className="text-xs text-gray-700">Condiciones favorables para Botrytis: HR {humidity}% y T {tmean}°C. En floración esta enfermedad puede reducir la producción hasta un 40%.</p>
                      <p className="text-xs text-gray-600 mt-2 font-medium">Recomendación: revisar aplicaciones preventivas de fungicida y mejorar ventilación del cultivo.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "fenologia" && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Acumulación de GDD base 3°C</h3>
                <p className="text-xs text-gray-500 mb-4">Evolución estimada hacia cosecha · variedad {selectedVariety.name}</p>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={gddEvolution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} label={{ value: "Días", position: "bottom", fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} label={{ value: "GDD acumulados", angle: -90, position: "insideLeft", fontSize: 11 }} />
                    <Tooltip />
                    <ReferenceLine y={selectedVariety.gddBase3} stroke="#dc2626" strokeDasharray="5 5" label={{ value: `Cosecha: ${selectedVariety.gddBase3} GDD`, position: "right", fontSize: 11, fill: "#dc2626" }} />
                    <ReferenceLine y={BBCH_PHASES[3].gddStart} stroke="#f97316" strokeDasharray="3 3" label={{ value: "Floración", position: "right", fontSize: 10, fill: "#f97316" }} />
                    <Line type="monotone" dataKey="gdd" stroke="#16a34a" strokeWidth={2} name="GDD acumulados" dot={false} />
                  </LineChart>
                </ResponsiveContainer>

                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Barras de duración por fase</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={phenoData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis type="number" tick={{ fontSize: 11 }} label={{ value: "GDD", position: "bottom", fontSize: 11 }} />
                      <YAxis type="category" dataKey="fase" tick={{ fontSize: 11 }} width={130} />
                      <Tooltip />
                      <Bar dataKey="duracion" name="Duración (GDD)" fill="#16a34a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {activeTab === "produccion" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Estimación de producción</h3>
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Producción estimada ciclo actual</p>
                      <p className="text-3xl font-bold text-gray-900">{yieldEst.toLocaleString()} <span className="text-base font-normal text-gray-500">kg/ha</span></p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Producción anual estimada ({selectedVariety.cyclesPerYear} ciclos)</p>
                      <p className="text-2xl font-bold text-green-700">{(yieldEst * selectedVariety.cyclesPerYear).toLocaleString()} <span className="text-base font-normal text-gray-500">kg/ha</span></p>
                    </div>
                    {farm?.totalHectares && (
                      <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                        <p className="text-xs text-gray-500 mb-1">Total finca ({farm.totalHectares} ha)</p>
                        <p className="text-2xl font-bold text-green-800">{Math.round(yieldEst * parseFloat(farm.totalHectares) * selectedVariety.cyclesPerYear).toLocaleString()} <span className="text-base font-normal text-gray-500">kg/año</span></p>
                      </div>
                    )}
                    <div className="border-t border-gray-100 pt-3 space-y-2">
                      <p className="text-xs font-medium text-gray-700">Factores de corrección aplicados:</p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">T media maduración ({tmean}°C)</span>
                        <span className={tmean > 25 ? "text-amber-600" : "text-green-600"}>{tmean > 28 ? "-30%" : tmean > 25 ? "-15%" : "Óptimo"}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Riesgo Botrytis</span>
                        <span className={botrytisRisk === "alto" ? "text-red-600" : botrytisRisk === "medio" ? "text-amber-600" : "text-green-600"}>
                          {botrytisRisk === "alto" ? "-25%" : botrytisRisk === "medio" ? "-10%" : "Sin penalización"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Modelo científico — bases</h3>
                  <div className="space-y-3 text-xs text-gray-600">
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                      <p className="font-medium text-blue-800 mb-1">Temperatura base GDD</p>
                      <p>La frambuesa usa <strong>base 3°C</strong> para el cálculo de grados-día (GDD). Desde brotación primaveral (o inducción en remontantes) hasta cosecha se necesitan {selectedVariety.gddBase3} GDD.</p>
                      <p className="mt-1 italic text-blue-700">Ref: MDPI Agronomy 2023 — Phenological model strawberry/raspberry</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                      <p className="font-medium text-amber-800 mb-1">Riesgo Botrytis cinerea</p>
                      <p>Condiciones favorables: HR {'>'} 85% y T entre 15-25°C, especialmente en floración. Primera enfermedad económica en frambuesa a nivel mundial.</p>
                      <p className="mt-1 italic text-amber-700">Ref: ScienceDirect 2024 — Strawberry/Raspberry fungal disease models</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                      <p className="font-medium text-green-800 mb-1">Variedades remontantes</p>
                      <p>Las variedades remontantes (Autumn Bliss, Heritage, Kweli) producen 2-3 ciclos anuales en climas semicálidos. Kweli y similares están adaptadas a zonas con menos de 200 horas frío.</p>
                      <p className="mt-1 italic text-green-700">Ref: PMC7589862 — Berry yield prediction model 2020</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

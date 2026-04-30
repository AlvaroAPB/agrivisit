import { useState } from "react";
import { Link } from "wouter";
import Sidebar from "../components/Sidebar";
import { trpc } from "../lib/trpc";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { TrendingUp, AlertTriangle, ChevronRight, Loader2, Leaf, Droplets, Thermometer, Info } from "lucide-react";

function fmt(n: number) { return n.toLocaleString("es-ES"); }

function FactorBar({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  const color = value >= 0.9 ? "bg-green-500" : value >= 0.7 ? "bg-amber-400" : "bg-red-400";
  const textColor = value >= 0.9 ? "text-green-600" : value >= 0.7 ? "text-amber-600" : "text-red-600";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500 flex items-center gap-1">{icon}{label}</span>
        <span className={`text-xs font-bold ${textColor}`}>{Math.round(value * 100)}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
    </div>
  );
}

function FarmPrediccion({ farmId }: { farmId: number }) {
  const year = new Date().getFullYear();
  const { data, isLoading, error } = trpc.prediction.predictFarm.useQuery({ farmId, year });

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-5 h-5 text-green-600 animate-spin mr-2" />
      <span className="text-sm text-gray-500">Calculando con datos climáticos reales...</span>
    </div>
  );

  if (error || !data) return (
    <div className="bg-red-50 rounded-xl p-4 text-sm text-red-600">
      {error?.message || "No se pudo calcular. Asegúrate de que la finca tiene coordenadas GPS y parcelas configuradas."}
    </div>
  );

  const proyeccionData = data.proyeccion.map(p => ({
    name: String(p.year),
    kgHa: p.kgHa,
    esFuturo: p.esFuturo,
  }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Producción estimada", value: `${fmt(data.totalKg)} kg`, sub: `${data.totalToneladas} t`, color: "text-green-600" },
          { label: "Rendimiento medio", value: `${fmt(data.rendimientoMedioKgHa)} kg/ha`, sub: "estimado", color: "text-blue-600" },
          { label: "Superficie total", value: `${data.superficieTotalHa} ha`, sub: `${data.parcelas.length} parcelas`, color: "text-purple-600" },
          { label: "Año campaña", value: String(year), sub: `${data.historico.length} años histórico`, color: "text-gray-700" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            <p className="text-xs text-gray-400">{s.sub}</p>
          </div>
        ))}
      </div>

      {proyeccionData.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-1">Histórico y proyección</h3>
          <p className="text-xs text-gray-400 mb-4">Verde sólido = datos reales · Verde claro = proyección del modelo</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={proyeccionData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}t/ha`} />
              <Tooltip formatter={(v: any) => [`${fmt(v)} kg/ha`, "Rendimiento"]} />
              <ReferenceLine y={data.rendimientoMedioKgHa} stroke="#16a34a" strokeDasharray="4 4" />
              <Bar dataKey="kgHa" name="Rendimiento" radius={[3,3,0,0]}>
                {proyeccionData.map((p, i) => (
                  <Cell key={i} fill={p.esFuturo ? "#86efac" : "#16a34a"} opacity={p.esFuturo ? 0.7 : 1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="font-semibold text-gray-700 text-sm">Detalle por parcela</h3>
        {data.parcelas.length === 0 && (
          <div className="bg-gray-50 rounded-xl p-6 text-center text-sm text-gray-400">
            Sin parcelas configuradas con datos suficientes.
          </div>
        )}
        {data.parcelas.map((p: any) => (
          <div key={p.parcelaId} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-gray-900 text-sm">{p.parcelaName}</p>
                <p className="text-xs text-gray-500">{p.especie} · {p.variedad} · {p.superficieHa} ha</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-green-700">{fmt(p.totalKg)} kg</p>
                <p className="text-xs text-gray-400">{p.totalToneladas} t · {fmt(p.rendimientoEstimadoKgHa)} kg/ha</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.confianza >= 75 ? "bg-green-100 text-green-700" : p.confianza >= 50 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                  Confianza {p.confianza}%
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-3 text-xs text-gray-400">
              <Info className="w-3.5 h-3.5" />
              Rango: <strong>{fmt(p.rangoMin)} kg</strong> — <strong>{fmt(p.rangoMax)} kg</strong>
            </div>
            <div className="grid grid-cols-5 gap-3 mb-3">
              <FactorBar label="Edad" value={p.factores.edad} icon={<Leaf className="w-3 h-3" />} />
              <FactorBar label="Frío" value={p.factores.frio} icon={<Thermometer className="w-3 h-3" />} />
              <FactorBar label="pH suelo" value={p.factores.suelo} />
              <FactorBar label="Riego" value={p.factores.riego} icon={<Droplets className="w-3 h-3" />} />
              <FactorBar label="Histórico" value={p.factores.historico} />
            </div>
            {p.alertas.length > 0 && (
              <div className="space-y-1">
                {p.alertas.map((a: string, i: number) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />{a}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Prediccion() {
  const { data: farms = [] } = trpc.farms.list.useQuery();
  const { data: resumenAll = [] } = trpc.prediction.predictAll.useQuery();
  const [selectedFarm, setSelectedFarm] = useState<number | null>(null);

  const totalTon = (resumenAll as any[]).reduce((s: number, f: any) => s + (f.totalToneladas || 0), 0);
  const totalHa = (resumenAll as any[]).reduce((s: number, f: any) => s + (f.superficieTotalHa || 0), 0);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-green-600" /> Predicción de cosecha
            </h1>
            <p className="text-sm text-gray-500 mt-1">Modelo agronómico: variedad · edad · clima · suelo · riego · histórico</p>
          </div>
        </div>

        {(resumenAll as any[]).length > 0 && !selectedFarm && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white rounded-xl border border-gray-100 p-4"><p className="text-2xl font-bold text-green-600">{totalTon.toFixed(1)} t</p><p className="text-xs text-gray-500">Producción total estimada</p></div>
            <div className="bg-white rounded-xl border border-gray-100 p-4"><p className="text-2xl font-bold text-blue-600">{totalHa.toFixed(1)} ha</p><p className="text-xs text-gray-500">Superficie total analizada</p></div>
            <div className="bg-white rounded-xl border border-gray-100 p-4"><p className="text-2xl font-bold text-purple-600">{(resumenAll as any[]).length}</p><p className="text-xs text-gray-500">Fincas con predicción</p></div>
          </div>
        )}

        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-1 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Fincas</p>
            {farms.map((f: any) => {
              const r = (resumenAll as any[]).find((x: any) => x.farmId === f.id);
              return (
                <button key={f.id} onClick={() => setSelectedFarm(f.id === selectedFarm ? null : f.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${selectedFarm === f.id ? "border-green-400 bg-green-50 shadow-sm" : "border-gray-100 bg-white hover:border-green-200"}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm text-gray-900 truncate">{f.name}</p>
                    <ChevronRight className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${selectedFarm === f.id ? "rotate-90" : ""}`} />
                  </div>
                  {r ? (
                    <div className="mt-1">
                      <p className="text-xs text-green-700 font-semibold">{r.totalToneladas.toFixed(1)} t estimadas</p>
                      <p className="text-xs text-gray-400">{r.superficieTotalHa} ha · {fmt(r.rendimientoMedioKgHa)} kg/ha</p>
                    </div>
                  ) : <p className="text-xs text-gray-400 mt-1">Sin parcelas</p>}
                </button>
              );
            })}
          </div>

          <div className="col-span-3">
            {selectedFarm
              ? <FarmPrediccion farmId={selectedFarm} />
              : (
                <div className="bg-white rounded-xl border border-dashed border-gray-200 p-16 text-center">
                  <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">Selecciona una finca para ver su predicción</p>
                  <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto">El modelo usa datos de variedad, edad de plantación, clima real (Open-Meteo) y el histórico de campañas registradas.</p>
                  <div className="grid grid-cols-5 gap-3 mt-8 text-xs text-gray-500">
                    {[["🌱","Edad","Año 1→15%, año 5+→100%"],["❄️","Frío","Chill Portions vs requerimiento"],["🪨","pH suelo","Rango óptimo por especie"],["💧","Riego","Dotación vs necesidad hídrica"],["📊","Histórico","Calibración con campañas reales"]].map(([icon, label, desc]) => (
                      <div key={label} className="bg-gray-50 rounded-lg p-3 text-left">
                        <p className="text-lg mb-1">{icon}</p>
                        <p className="font-medium text-gray-700">{label}</p>
                        <p className="text-gray-400 mt-0.5">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }
          </div>
        </div>
      </main>
    </div>
  );
}

import { useState } from "react";
import Sidebar from "../components/Sidebar";
import { CATALOGO, GRUPOS, type Variedad, type GrupoEspecie } from "../lib/catalogo";
import { Leaf, Snowflake, Thermometer, Star, Shield, ChevronRight, Search } from "lucide-react";

export default function Cultivos() {
  const [grupoActivo, setGrupoActivo] = useState<GrupoEspecie | "all">("all");
  const [especieActiva, setEspecieActiva] = useState<string | null>(null);
  const [variedadActiva, setVariedadActiva] = useState<Variedad | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const especiesFiltradas = CATALOGO.filter(e =>
    grupoActivo === "all" || e.grupo === grupoActivo
  ).filter(e =>
    busqueda === "" ||
    e.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    e.variedades.some(v => v.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  );

  const groupColors: Record<GrupoEspecie, string> = {
    hueso: "bg-amber-50 text-amber-800 border-amber-200",
    arandano: "bg-blue-50 text-blue-800 border-blue-200",
    frambuesa: "bg-red-50 text-red-800 border-red-200",
  };

  const groupDot: Record<GrupoEspecie, string> = {
    hueso: "bg-amber-500",
    arandano: "bg-blue-500",
    frambuesa: "bg-red-500",
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cultivos y variedades</h1>
            <p className="text-sm text-gray-500 mt-1">
              Catálogo de especies y variedades de SAT Royal · {CATALOGO.reduce((n, e) => n + e.variedades.length, 0)} variedades · Fuente: datos propios + literatura científica
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
            ⚠ Datos ficticios para validación — importa el Excel para actualizar
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar especie o variedad..."
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 w-56" />
          </div>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setGrupoActivo("all")}
              className={`px-3 py-1.5 text-xs rounded-md ${grupoActivo === "all" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
              Todos
            </button>
            {GRUPOS.map(g => (
              <button key={g.id} onClick={() => setGrupoActivo(g.id)}
                className={`px-3 py-1.5 text-xs rounded-md ${grupoActivo === g.id ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}>
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-5">
          {/* Lista de especies */}
          <div className="col-span-3 space-y-2">
            {especiesFiltradas.map(esp => (
              <button key={esp.nombre} onClick={() => { setEspecieActiva(esp.nombre); setVariedadActiva(null); }}
                className={`w-full text-left p-3 rounded-xl border transition-all ${especieActiva === esp.nombre ? "border-green-300 bg-green-50 shadow-sm" : "border-gray-100 bg-white hover:border-gray-200"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${groupDot[esp.grupo]}`} />
                  <span className="text-sm font-medium text-gray-900">{esp.nombre}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 ml-auto" />
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${groupColors[esp.grupo]}`}>{GRUPOS.find(g => g.id === esp.grupo)?.label}</span>
                  <span className="text-xs text-gray-400">{esp.variedades.length} var.</span>
                </div>
              </button>
            ))}
          </div>

          {/* Lista de variedades */}
          <div className="col-span-4 space-y-2">
            {especieActiva ? (
              <>
                {(CATALOGO.find(e => e.nombre === especieActiva)?.variedades ?? [])
                  .filter(v => busqueda === "" || v.nombre.toLowerCase().includes(busqueda.toLowerCase()))
                  .map(v => (
                    <button key={v.id} onClick={() => setVariedadActiva(v)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${variedadActiva?.id === v.id ? "border-green-300 bg-green-50 shadow-sm" : "border-gray-100 bg-white hover:border-gray-200"}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm font-medium text-gray-900">{v.nombre}</span>
                        {v.protegida && <Shield className="w-3 h-3 text-amber-600" title="Variedad protegida" />}
                        {v.obtentor === "SAT Royal" && <Star className="w-3 h-3 text-green-600" title="Variedad propia Royal" />}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {v.chillPortions !== undefined && (
                          <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">
                            <Snowflake className="w-2.5 h-2.5 inline mr-0.5" />{v.chillPortions} CP
                          </span>
                        )}
                        {v.chillHours !== undefined && (
                          <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">
                            <Snowflake className="w-2.5 h-2.5 inline mr-0.5" />{v.chillHours} h frío
                          </span>
                        )}
                        {v.brixOpt && (
                          <span className="text-xs px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded">{v.brixOpt}° Brix</span>
                        )}
                        {v.calibreOptMm && (
                          <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{v.calibreOptMm}mm</span>
                        )}
                      </div>
                    </button>
                  ))}
              </>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
                <Leaf className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Selecciona una especie</p>
              </div>
            )}
          </div>

          {/* Ficha de variedad */}
          <div className="col-span-5">
            {variedadActiva ? (
              <div className="bg-white rounded-xl border border-gray-100 p-5 sticky top-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{variedadActiva.nombre}</h2>
                    <p className="text-sm text-gray-500">{variedadActiva.especie}</p>
                  </div>
                  <div className="flex gap-2">
                    {variedadActiva.protegida && (
                      <span className="flex items-center gap-1 text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200">
                        <Shield className="w-3 h-3" /> Protegida
                      </span>
                    )}
                    {variedadActiva.obtentor === "SAT Royal" && (
                      <span className="flex items-center gap-1 text-xs px-2 py-1 bg-green-50 text-green-700 rounded-full border border-green-200">
                        <Star className="w-3 h-3" /> Royal
                      </span>
                    )}
                  </div>
                </div>

                {/* Parámetros agronómicos */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {variedadActiva.chillPortions !== undefined && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-blue-600 mb-0.5">Req. frío (Dynamic)</p>
                      <p className="text-xl font-bold text-blue-800">{variedadActiva.chillPortions} CP</p>
                    </div>
                  )}
                  {variedadActiva.chillHours !== undefined && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-blue-600 mb-0.5">Horas frío</p>
                      <p className="text-xl font-bold text-blue-800">{variedadActiva.chillHours} h</p>
                    </div>
                  )}
                  {variedadActiva.gddBloomToHarvest !== undefined && (
                    <div className="bg-orange-50 rounded-lg p-3">
                      <p className="text-xs text-orange-600 mb-0.5">GDD flor→cosecha (b.10°C)</p>
                      <p className="text-xl font-bold text-orange-800">{variedadActiva.gddBloomToHarvest}</p>
                    </div>
                  )}
                  {variedadActiva.gddBase4 !== undefined && (
                    <div className="bg-orange-50 rounded-lg p-3">
                      <p className="text-xs text-orange-600 mb-0.5">GDD brot.→cosecha (b.4.4°C)</p>
                      <p className="text-xl font-bold text-orange-800">{variedadActiva.gddBase4}</p>
                    </div>
                  )}
                  {variedadActiva.gddBase3 !== undefined && (
                    <div className="bg-orange-50 rounded-lg p-3">
                      <p className="text-xs text-orange-600 mb-0.5">GDD brot.→cosecha (b.3°C)</p>
                      <p className="text-xl font-bold text-orange-800">{variedadActiva.gddBase3}</p>
                    </div>
                  )}
                  {variedadActiva.fdpDias !== undefined && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">FDP (días)</p>
                      <p className="text-xl font-bold text-gray-800">{variedadActiva.fdpDias}</p>
                    </div>
                  )}
                  {variedadActiva.ciclosAnio !== undefined && (
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs text-green-600 mb-0.5">Ciclos/año</p>
                      <p className="text-xl font-bold text-green-800">{variedadActiva.ciclosAnio}</p>
                    </div>
                  )}
                  <div className="bg-amber-50 rounded-lg p-3">
                    <p className="text-xs text-amber-600 mb-0.5">Brix óptimo</p>
                    <p className="text-xl font-bold text-amber-800">{variedadActiva.brixOpt}°</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-0.5">Calibre óptimo</p>
                    <p className="text-xl font-bold text-gray-800">{variedadActiva.calibreOptMm}mm</p>
                  </div>
                  {variedadActiva.pesoFrutoG && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">Peso fruto</p>
                      <p className="text-xl font-bold text-gray-800">{variedadActiva.pesoFrutoG}g</p>
                    </div>
                  )}
                </div>

                {/* Info agronómica */}
                <div className="space-y-2 text-sm border-t border-gray-100 pt-3">
                  {variedadActiva.obtentor && (
                    <div className="flex gap-2">
                      <span className="text-gray-500 w-24 flex-shrink-0">Obtentor</span>
                      <span className="text-gray-900">{variedadActiva.obtentor}</span>
                    </div>
                  )}
                  {variedadActiva.portainjertosRec && (
                    <div className="flex gap-2">
                      <span className="text-gray-500 w-24 flex-shrink-0">Portainjertos</span>
                      <span className="text-gray-900">{variedadActiva.portainjertosRec.join(", ")}</span>
                    </div>
                  )}
                  {variedadActiva.densidadRec && (
                    <div className="flex gap-2">
                      <span className="text-gray-500 w-24 flex-shrink-0">Densidad rec.</span>
                      <span className="text-gray-900">{variedadActiva.densidadRec}</span>
                    </div>
                  )}
                  {variedadActiva.conduccionRec && (
                    <div className="flex gap-2">
                      <span className="text-gray-500 w-24 flex-shrink-0">Conducción</span>
                      <span className="text-gray-900">{variedadActiva.conduccionRec}</span>
                    </div>
                  )}
                  {variedadActiva.observaciones && (
                    <div className="mt-3 bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-600 leading-relaxed">{variedadActiva.observaciones}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
                <Leaf className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Selecciona una variedad para ver su ficha</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

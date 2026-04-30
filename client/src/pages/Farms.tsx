import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { trpc } from "../lib/trpc";
import { MapPin, Plus, ChevronRight, ChevronLeft, Save, Loader2, Trash2, AlertTriangle, CheckCircle2, RotateCcw, Info } from "lucide-react";
import MapaSatelite from "../components/MapaSatelite";
import { Link } from "wouter";
import { CATALOGO, getAllVariedades, type Variedad } from "../lib/catalogo";

const PAISES = ["España","Portugal","Marruecos","Perú","Sudáfrica"];
const SISTEMAS_RIEGO = ["Goteo","Microaspersión","Aspersión","Secano","Mixto"];
const TIPOS_GOTERO = ["Gotero integrado autocompensante","Gotero integrado no compensante","Gotero pinchado","Difusor","Microaspersor","Cinta de exudación"];
const TIPOS_SUELO = ["Franco","Franco-arcilloso","Arcilloso","Franco-arenoso","Arenoso","Limoso","Otro"];
const ORIGENES_AGUA = ["Pozo propio","Acequia / Canal","Embalse","Red de riego","Mixto"];
const PENDIENTES = ["Llano (0-2%)","Suave (2-5%)","Moderada (5-15%)","Fuerte (>15%)"];
const SECCIONES = ["Identificación","Cultivo","Suelo y agua"];

// Conducción según grupo de especie
const CONDUCCION_HUESO = ["Vaso","Espaldera simple","Espaldera doble","Intensivo","Súper-intensivo"];
const CONDUCCION_ARANDANO = ["Hilera simple","Hilera con malla","Arco tutorado"];
const CONDUCCION_FRAMBUESA = ["Espaldera doble","Espaldera simple con tutor","Hilera libre"];
const CONDUCCION_OTROS = ["Vaso","Espaldera simple","Espaldera doble","Intensivo","Súper-intensivo","Hilera","Otro"];

function getConductionOptions(grupo: string): string[] {
  if (grupo === "hueso") return CONDUCCION_HUESO;
  if (grupo === "arandano") return CONDUCCION_ARANDANO;
  if (grupo === "frambuesa") return CONDUCCION_FRAMBUESA;
  return CONDUCCION_OTROS;
}

function F({ label, req, children, hint }: { label: string; req?: boolean; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}{req && <span className="text-red-400 ml-1">*</span>}</label>
      {children}
      {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
    </div>
  );
}
const ic = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";
const sc = ic + " bg-white";

interface FF {
  name:string; pais:string; region:string; municipio:string; refCatastral:string;
  lat:string; lng:string; altitud:string; superficie:string; encargado:string; telEncargado:string;
  polygon: number[][] | null;
  // Valores oficiales del geocoding (read-only, se sobreescriben al marcar mapa)
  paisOficial:string; regionOficial:string; municipioOficial:string;
  especie:string; variedad:string; anyoPlantacion:string; anyoProduccion:string;
  distLineas:string; distPlantas:string; densidad:string; conduccion:string;
  portainjerto:string; nPlantas:string; requerimientoFrio:string;
  tipoSuelo:string; ph:string; materiaOrganica:string; analisisSuelo:string;
  sistemaRiego:string; tipoGotero:string; caudalGotero:string; distGoteros:string;
  origenAgua:string; dotacionAgua:string; pendiente:string;
  observaciones:string;
}

const E:FF = {
  name:"",pais:"España",region:"",municipio:"",refCatastral:"",
  lat:"",lng:"",altitud:"",superficie:"",encargado:"",telEncargado:"",
  polygon: null,
  paisOficial:"",regionOficial:"",municipioOficial:"",
  especie:"",variedad:"",anyoPlantacion:"",anyoProduccion:"",
  distLineas:"",distPlantas:"",densidad:"",conduccion:"",
  portainjerto:"",nPlantas:"",requerimientoFrio:"",
  tipoSuelo:"",ph:"",materiaOrganica:"",analisisSuelo:"No",
  sistemaRiego:"",tipoGotero:"",caudalGotero:"",distGoteros:"",
  origenAgua:"",dotacionAgua:"",pendiente:"",
  observaciones:"",
};

// Comparación normalizada (ignora mayúsculas, acentos y espacios extras)
function normalize(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

// Normalizar superficie: "45,5 Ha" → "45.5", "6.24ha" → "6.24"
function normalizeSuperficie(s: string): string {
  return (s || "").replace(/[hHaA ]/g, "").replace(",", ".");
}
function valuesMatch(user: string, official: string): boolean {
  if (!official) return true; // sin oficial, no hay validación
  if (!user) return false;
  return normalize(user) === normalize(official);
}

// Componente de validación visual
function ValidationHint({ user, official, onApply }: { user: string; official: string; onApply?: () => void }) {
  if (!official) return null;
  const match = valuesMatch(user, official);
  if (match) {
    return (
      <div className="flex items-center gap-1 text-green-600 text-xs">
        <CheckCircle2 className="w-3 h-3" />
        <span>Coincide con el mapa</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 text-amber-600 text-xs">
      <AlertTriangle className="w-3 h-3" />
      <span>El mapa detecta: </span>
      <button
        onClick={onApply}
        className="font-bold underline underline-offset-2 hover:text-amber-800 cursor-pointer"
      >{official}</button>
      <span className="text-amber-400">← pulsa para aplicar</span>
    </div>
  );
}

function Modal({ onClose, onSaved }: { onClose:()=>void; onSaved:()=>void }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState<FF>(E);
  const [dotacionUnit, setDotacionUnit] = useState<"m3" | "mm">("m3");
  const create = trpc.farms.create.useMutation({ onSuccess: () => { onSaved(); onClose(); } });
  const set = (k: keyof FF) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => setF(p => ({...p,[k]:e.target.value}));

  // Detectar si hay discrepancias entre lo escrito y lo oficial
  const hasOfficial = !!(f.paisOficial || f.regionOficial || f.municipioOficial);
  const paisMatch = valuesMatch(f.pais, f.paisOficial);
  const regionMatch = valuesMatch(f.region, f.regionOficial);
  const municipioMatch = valuesMatch(f.municipio, f.municipioOficial);
  const allMatch = paisMatch && regionMatch && municipioMatch;
  const showWarning = hasOfficial && !allMatch;

  const restoreFromMap = () => {
    setF(p => ({
      ...p,
      pais: PAISES.includes(p.paisOficial) ? p.paisOficial : p.pais,
      region: p.regionOficial || p.region,
      municipio: p.municipioOficial || p.municipio,
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Nueva ficha de finca</h2>
            <p className="text-sm text-gray-500">{step+1} de {SECCIONES.length} — {SECCIONES[step]}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>
        <div className="flex px-5 pt-3 gap-1.5">
          {SECCIONES.map((_,i) => <div key={i} className={`flex-1 h-1.5 rounded-full ${i<=step?"bg-green-500":"bg-gray-100"}`}/>)}
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {step===0 && <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><F label="Nombre de la finca" req><input value={f.name} onChange={set("name")} className={ic} placeholder="Ej: Finca Las Marismas"/></F></div>

            {/* Banner de validación si hay discrepancias */}
            {showWarning && (
              <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 text-sm">
                  <p className="font-medium text-amber-900">Discrepancia con los datos del mapa</p>
                  <p className="text-amber-700 text-xs mt-0.5">Los datos del mapa son los oficiales. Para una BD limpia se recomienda usar los valores detectados.</p>
                </div>
                <button onClick={restoreFromMap} className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs hover:bg-amber-700 flex-shrink-0">
                  <RotateCcw className="w-3 h-3" /> Restaurar mapa
                </button>
              </div>
            )}
            {hasOfficial && allMatch && (
              <div className="col-span-2 bg-green-50 border border-green-200 rounded-lg p-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                <p className="text-xs text-green-800">Datos verificados con el mapa ✓</p>
              </div>
            )}

            <F label="País" req
              hint={f.paisOficial && <ValidationHint user={f.pais} official={f.paisOficial} onApply={()=>setF(p=>({...p,pais:PAISES.includes(p.paisOficial)?p.paisOficial:p.pais}))} />}>
              <select value={f.pais} onChange={e=>setF(p=>({...p,pais:e.target.value}))} className={sc}>{PAISES.map(p=><option key={p}>{p}</option>)}</select>
            </F>
            <F label="Región / Provincia" req
              hint={f.regionOficial && <ValidationHint user={f.region} official={f.regionOficial} onApply={()=>setF(p=>({...p,region:p.regionOficial}))} />}>
              <input value={f.region} onChange={set("region")} className={ic} placeholder="Ej: Sevilla, Souss-Massa..."/>
            </F>
            <F label="Municipio" req
              hint={f.municipioOficial && <ValidationHint user={f.municipio} official={f.municipioOficial} onApply={()=>setF(p=>({...p,municipio:p.municipioOficial}))} />}>
              <input value={f.municipio} onChange={set("municipio")} className={ic} placeholder="Ej: La Rinconada"/>
            </F>
            <F label="Referencia catastral"><input value={f.refCatastral} onChange={set("refCatastral")} className={ic} placeholder="Pol. 12 / Parc. 45"/></F>
            <F label="Latitud"><input value={f.lat} onChange={set("lat")} className={ic} type="number" step="0.0001"/></F>
            <F label="Longitud"><input value={f.lng} onChange={set("lng")} className={ic} type="number" step="0.0001"/></F>
            <F label="Altitud (m)" hint="Auto desde clic en mapa"><input value={f.altitud} onChange={set("altitud")} className={ic} type="number"/></F>
            <F label="Superficie total (ha)" req
              hint={<>
                {f.polygon ? <span className="text-green-600">✓ Calculada del polígono</span> : "Manual o dibuja parcela en el mapa"}
                {f.superficie && f.polygon && Math.abs(parseFloat(normalizeSuperficie(f.superficie)) - parseFloat(f.superficie || "0")) > 0.05 && (
                  <span className="text-amber-600 ml-2">⚠ Superficie editada manualmente</span>
                )}
              </>}>
              <input value={f.superficie}
                onChange={e => setF(p => ({...p, superficie: normalizeSuperficie(e.target.value)}))}
                onBlur={e => setF(p => ({...p, superficie: normalizeSuperficie(e.target.value)}))}
                className={ic} placeholder="Ej: 45.5" /></F>
            <F label="Encargado de campo"><input value={f.encargado} onChange={set("encargado")} className={ic} placeholder="Nombre"/></F>
            <F label="Teléfono encargado"><input value={f.telEncargado} onChange={set("telEncargado")} className={ic} placeholder="+34 600 000 000"/></F>
            <MapaSatelite lat={f.lat} lng={f.lng} pais={f.pais}
              initialPolygon={f.polygon}
              onSelect={(la,lo)=>setF(p=>({...p,lat:String(la),lng:String(lo)}))}
              onLocationFound={(info)=>setF(p=>({
                ...p,
                // Sobrescribir con los oficiales del mapa
                municipio: info.municipio || p.municipio,
                region: info.region || p.region,
                pais: PAISES.includes(info.pais || "") ? (info.pais as string) : p.pais,
                altitud: info.altitud || p.altitud,
                // Guardar oficiales para validación
                municipioOficial: info.municipio || p.municipioOficial,
                regionOficial: info.region || p.regionOficial,
                paisOficial: info.pais || p.paisOficial,
              }))}
              onPolygonChange={(info)=>setF(p=>({
                ...p,
                polygon: info.polygon,
                superficie: info.areaHa != null ? info.areaHa.toFixed(2) : p.superficie,
              }))} />
          </div>}

          {step===1 && (() => {
            // Desplegables encadenados desde el catálogo
            const especieCat = CATALOGO.find(e => e.nombre === f.especie);
            const variedadCat = especieCat?.variedades.find(v => v.nombre === f.variedad);
            const grupoCat = especieCat?.grupo ?? "";
            const conducciones = getConductionOptions(grupoCat);

            return (
            <div className="grid grid-cols-2 gap-4">
              {/* Especie desde catálogo */}
              <F label="Especie" req>
                <select value={f.especie} onChange={e => setF(p => ({
                  ...p, especie: e.target.value, variedad: "", portainjerto: "", conduccion: "", requerimientoFrio: ""
                }))} className={sc}>
                  <option value="">Selecciona especie...</option>
                  {CATALOGO.map(esp => (
                    <option key={esp.nombre} value={esp.nombre}>{esp.nombre}</option>
                  ))}
                </select>
              </F>

              {/* Variedad desde catálogo — encadenada a especie */}
              <F label="Variedad" req hint={!f.especie ? "Selecciona primero la especie" : undefined}>
                <select value={f.variedad} onChange={e => {
                  const v = especieCat?.variedades.find(x => x.nombre === e.target.value);
                  setF(p => ({
                    ...p,
                    variedad: e.target.value,
                    // Autorellenar desde catálogo
                    portainjerto: v?.portainjertosRec?.[0] ?? p.portainjerto,
                    conduccion: v?.conduccionRec?.split("/")[0].trim() ?? p.conduccion,
                    requerimientoFrio: v?.chillPortions?.toString() ?? v?.chillHours?.toString() ?? p.requerimientoFrio,
                    distLineas: v?.densidadRec ? v.densidadRec.split("×")[0] : p.distLineas,
                    distPlantas: v?.densidadRec ? v.densidadRec.split("×")[1]?.split(" ")[0] : p.distPlantas,
                  }));
                }} className={sc} disabled={!f.especie}>
                  <option value="">{f.especie ? "Selecciona variedad..." : "— elige especie primero —"}</option>
                  {especieCat?.variedades.map(v => (
                    <option key={v.id} value={v.nombre}>
                      {v.nombre}{v.protegida ? " ®" : ""}
                    </option>
                  ))}
                </select>
              </F>

              {/* Info de la variedad seleccionada */}
              {variedadCat && (
                <div className="col-span-2 bg-green-50 border border-green-200 rounded-lg p-3 flex flex-wrap gap-3 text-xs">
                  <div className="flex items-center gap-1 text-green-800">
                    <Info className="w-3.5 h-3.5" />
                    <strong>{variedadCat.nombre}</strong>
                    {variedadCat.obtentor && <span className="text-green-600">· {variedadCat.obtentor}</span>}
                  </div>
                  {variedadCat.chillPortions && <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{variedadCat.chillPortions} CP frío</span>}
                  {variedadCat.chillHours && <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{variedadCat.chillHours} h frío</span>}
                  {variedadCat.calibreOptMm && <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">Calibre opt. {variedadCat.calibreOptMm}mm</span>}
                  {variedadCat.brixOpt && <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">{variedadCat.brixOpt}° Brix</span>}
                  {variedadCat.densidadRec && <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">Marco rec. {variedadCat.densidadRec}</span>}
                </div>
              )}

              <F label="Año de plantación" req><input value={f.anyoPlantacion} onChange={set("anyoPlantacion")} className={ic} placeholder="Ej: 2018" type="number"/></F>
              <F label="Año entrada en producción"><input value={f.anyoProduccion} onChange={set("anyoProduccion")} className={ic} placeholder="Ej: 2020" type="number"/></F>

              {/* Conducción limitada por grupo */}
              <F label="Sistema de conducción"
                hint={grupoCat ? <span className="text-green-600">Opciones para {especieCat?.nombre}</span> : undefined}>
                <select value={f.conduccion} onChange={set("conduccion")} className={sc}>
                  <option value="">Selecciona...</option>
                  {conducciones.map(s => <option key={s}>{s}</option>)}
                </select>
              </F>

              {/* Portainjerto — sugerido desde catálogo */}
              <F label="Portainjerto"
                hint={variedadCat?.portainjertosRec && <span className="text-green-600">Rec: {variedadCat.portainjertosRec.join(", ")}</span>}>
                <input value={f.portainjerto} onChange={set("portainjerto")} className={ic}
                  placeholder={variedadCat?.portainjertosRec?.[0] ?? "Ej: GF677"} />
              </F>

              <F label="Distancia entre líneas (m)" req>
                <input value={f.distLineas} onChange={e => setF(p => ({ ...p, distLineas: e.target.value }))}
                  className={ic} placeholder="Ej: 4.0" type="number" step="0.1"/>
              </F>
              <F label="Distancia entre plantas (m)" req>
                <input value={f.distPlantas} onChange={e => setF(p => ({ ...p, distPlantas: e.target.value }))}
                  className={ic} placeholder="Ej: 1.5" type="number" step="0.1"/>
              </F>

              {(() => {
                const dl = parseFloat(f.distLineas);
                const dp = parseFloat(f.distPlantas);
                const sup = parseFloat(normalizeSuperficie(f.superficie));
                const densCalc = dl > 0 && dp > 0 ? Math.round(10000 / (dl * dp)) : null;
                const plantasCalc = densCalc && sup > 0 ? Math.round(densCalc * sup) : null;
                return (
                  <>
                    <F label="Densidad calculada (plantas/ha)">
                      <div className={`${ic} ${densCalc ? "bg-green-50 text-green-700 font-semibold" : "bg-gray-50 text-gray-400"}`}>
                        {densCalc ? `${densCalc} plantas/ha` : "Introduce distancias para calcular"}
                      </div>
                    </F>
                    <F label="Nº total de plantas" hint={plantasCalc ? <span className="text-green-600">Auto = {densCalc} pl/ha × {sup} ha</span> : "Auto cuando haya distancias y superficie"}>
                      <div className={`${ic} ${plantasCalc ? "bg-green-50 text-green-700 font-semibold" : "bg-gray-50 text-gray-400"}`}>
                        {plantasCalc ? `${plantasCalc.toLocaleString()} plantas` : "—"}
                      </div>
                    </F>
                  </>
                );
              })()}

              <div className="col-span-2 border-t border-gray-100 pt-3 mt-2">
                <p className="text-xs text-gray-500 mb-2">Datos para predicción climática</p>
                <F label="Requerimiento de frío"
                  hint={variedadCat?.chillPortions
                    ? <span className="text-green-600">✓ Autorellenado del catálogo — {variedadCat.chillPortions} CP (Dynamic Model)</span>
                    : variedadCat?.chillHours
                    ? <span className="text-green-600">✓ Autorellenado del catálogo — {variedadCat.chillHours} h frío</span>
                    : grupoCat === "hueso" ? "Chill Portions (CP) del Dynamic Model" : "Horas de frío <7.2°C"}>
                  <input value={f.requerimientoFrio} onChange={set("requerimientoFrio")} className={ic} type="number" step="1"
                    placeholder={grupoCat === "hueso" ? "Ej: 35 CP" : "Ej: 200 h"} />
                </F>
              </div>
            </div>
          );})()}

          {step===2 && <div className="grid grid-cols-2 gap-4">
            <F label="Tipo de suelo"><select value={f.tipoSuelo} onChange={set("tipoSuelo")} className={sc}><option value="">Selecciona...</option>{TIPOS_SUELO.map(s=><option key={s}>{s}</option>)}</select></F>
            <F label="Pendiente media"><select value={f.pendiente} onChange={set("pendiente")} className={sc}><option value="">Selecciona...</option>{PENDIENTES.map(p=><option key={p}>{p}</option>)}</select></F>
            <F label="pH del suelo"><input value={f.ph} onChange={set("ph")} className={ic} placeholder="Ej: 7.2" type="number" step="0.1"/></F>
            <F label="Materia orgánica (%)"><input value={f.materiaOrganica} onChange={set("materiaOrganica")} className={ic} placeholder="Ej: 1.8" type="number" step="0.1"/></F>
            <F label="Análisis de suelo"><select value={f.analisisSuelo} onChange={set("analisisSuelo")} className={sc}><option>No</option><option>Sí — reciente (menos de 2 años)</option><option>Sí — antiguo (más de 2 años)</option></select></F>
            <F label="Sistema de riego" req><select value={f.sistemaRiego} onChange={set("sistemaRiego")} className={sc}><option value="">Selecciona...</option>{SISTEMAS_RIEGO.map(s=><option key={s}>{s}</option>)}</select></F>
            {(f.sistemaRiego==="Goteo"||f.sistemaRiego==="Microaspersión") && <>
              <F label="Tipo de emisor"><select value={f.tipoGotero} onChange={set("tipoGotero")} className={sc}><option value="">Selecciona...</option>{TIPOS_GOTERO.map(t=><option key={t}>{t}</option>)}</select></F>
              <F label="Caudal del emisor (l/h)"><input value={f.caudalGotero} onChange={set("caudalGotero")} className={ic} type="number" step="0.1" placeholder="Ej: 2.3"/></F>
              <F label="Distancia entre emisores (m)"><input value={f.distGoteros} onChange={set("distGoteros")} className={ic} type="number" step="0.05" placeholder="Ej: 0.75"/></F>
            </>}
            <F label="Origen del agua"><select value={f.origenAgua} onChange={set("origenAgua")} className={sc}><option value="">Selecciona...</option>{ORIGENES_AGUA.map(o=><option key={o}>{o}</option>)}</select></F>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500 font-medium">Dotación agua</label>
                <div className="flex gap-0.5 bg-gray-100 rounded-md p-0.5">
                  {(["m3", "mm"] as const).map(u => (
                    <button key={u} type="button"
                      onClick={() => {
                        if (u === dotacionUnit) return;
                        setDotacionUnit(u);
                        if (f.dotacionAgua) {
                          const v = parseFloat(f.dotacionAgua);
                          if (!isNaN(v)) setF(p => ({ ...p, dotacionAgua: u === "mm" ? (v / 10).toFixed(1) : (v * 10).toFixed(0) }));
                        }
                      }}
                      className={`px-2 py-0.5 text-xs rounded transition-all ${dotacionUnit === u ? "bg-white shadow text-gray-900 font-medium" : "text-gray-500 hover:text-gray-700"}`}
                    >{u === "m3" ? "m³/ha" : "mm"}</button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <input value={f.dotacionAgua} onChange={set("dotacionAgua")} className={ic} type="number" placeholder={dotacionUnit === "m3" ? "Ej: 4500" : "Ej: 450"} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">{dotacionUnit === "m3" ? "m³/ha/año" : "mm/año"}</span>
              </div>
              {f.dotacionAgua && (
                <p className="text-xs text-gray-400 mt-1">
                  ≈ {dotacionUnit === "m3" ? `${(parseFloat(f.dotacionAgua)/10).toFixed(1)} mm/año` : `${(parseFloat(f.dotacionAgua)*10).toFixed(0)} m³/ha/año`}
                </p>
              )}
            </div>
            <div className="col-span-2"><F label="Observaciones generales"><textarea value={f.observaciones} onChange={set("observaciones")} className={`${ic} resize-none`} rows={3} placeholder="Notas técnicas, infraestructura, etc."/></F></div>
            {create.error && <p className="col-span-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{create.error.message}</p>}
          </div>}
        </div>

        <div className="p-4 border-t border-gray-100 flex items-center justify-between">
          <button onClick={()=>setStep(s=>s-1)} disabled={step===0} className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">
            <ChevronLeft className="w-4 h-4"/> Anterior
          </button>
          <span className="text-xs text-gray-400">{step+1} / {SECCIONES.length}</span>
          {step<SECCIONES.length-1
            ? <button onClick={()=>setStep(s=>s+1)} disabled={step===0&&!f.name} className="flex items-center gap-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40">Siguiente <ChevronRight className="w-4 h-4"/></button>
            : <button onClick={() => {
                const dl = parseFloat(f.distLineas);
                const dp = parseFloat(f.distPlantas);
                const sup = parseFloat(normalizeSuperficie(f.superficie));
                const densCalc = dl > 0 && dp > 0 ? Math.round(10000 / (dl * dp)) : null;
                const plantasCalc = densCalc && sup > 0 ? Math.round(densCalc * sup) : null;
                const fConDatos = {
                  ...f,
                  densidad: densCalc ? String(densCalc) : f.densidad,
                  nPlantas: plantasCalc ? String(plantasCalc) : f.nPlantas,
                };
                create.mutate({
                  name: f.name,
                  location: `${f.municipio}, ${f.region}, ${f.pais}`,
                  totalHectares: normalizeSuperficie(f.superficie),
                  latitude: f.lat ? parseFloat(f.lat) : undefined,
                  longitude: f.lng ? parseFloat(f.lng) : undefined,
                  description: JSON.stringify(fConDatos),
                });
              }} disabled={create.isPending||!f.name} className="flex items-center gap-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              {create.isPending?<><Loader2 className="w-4 h-4 animate-spin"/>Guardando...</>:<><Save className="w-4 h-4"/>Guardar</>}
            </button>
          }
        </div>
      </div>
    </div>
  );
}

// Componente que valida una ficha al vuelo y muestra badge si hay discrepancia
function FarmCard({ farm, onDelete }: { farm: any; onDelete: () => void }) {
  let ex: any = {};
  try { ex = JSON.parse(farm.description || "{}"); } catch {}

  const [official, setOfficial] = useState<{ municipio: string; region: string; pais: string } | null>(null);

  useEffect(() => {
    // Si no hay datos oficiales guardados pero hay coordenadas, validar al vuelo
    if (!ex.paisOficial && farm.latitude && farm.longitude) {
      const url = `https://api.maptiler.com/geocoding/${farm.longitude},${farm.latitude}.json?key=XgBpftLrirF6DzSrbFzv&language=es`;
      fetch(url).then(r => r.json()).then(data => {
        const feature = data.features?.[0];
        if (!feature) return;
        let municipio = "", region = "", pais = "";
        if (feature.context) {
          for (const ctx of feature.context as any[]) {
            if (ctx.id?.startsWith("municipality") || ctx.id?.startsWith("place")) municipio = ctx.text;
            else if (ctx.id?.startsWith("region") || ctx.id?.startsWith("subregion")) region = ctx.text;
            else if (ctx.id?.startsWith("country")) pais = ctx.text;
          }
        }
        if (!municipio && feature.place_type?.includes("place")) municipio = feature.text;
        setOfficial({ municipio, region, pais });
      }).catch(() => {});
    } else if (ex.paisOficial) {
      setOfficial({ municipio: ex.municipioOficial, region: ex.regionOficial, pais: ex.paisOficial });
    }
  }, []);

  const hasDiscrepancy = official && (
    !valuesMatch(ex.pais || "", official.pais) ||
    !valuesMatch(ex.region || "", official.region) ||
    !valuesMatch(ex.municipio || "", official.municipio)
  );

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:border-green-200 transition-colors overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <MapPin className="w-5 h-5 text-green-600" />
          </div>
          <button onClick={onDelete} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
        </div>
        <Link href={`/fincas/${farm.id}`}>
          <a className="block">
            <h3 className="font-semibold text-gray-900 hover:text-green-700 mb-1">{farm.name}</h3>
            {farm.location && <p className="text-sm text-gray-500 mb-2">{farm.location}</p>}
            <div className="flex flex-wrap gap-1.5">
              {ex.especie && <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full">{ex.especie}</span>}
              {ex.variedad && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{ex.variedad}</span>}
              {farm.totalHectares && <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{farm.totalHectares} ha</span>}
              {ex.sistemaRiego && <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full">{ex.sistemaRiego}</span>}
              {ex.polygon && <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">📐 Parcela dibujada</span>}
              {hasDiscrepancy && <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full flex items-center gap-1 font-medium" title="Los datos no coinciden con el mapa"><AlertTriangle className="w-3 h-3" /> Sin verificar</span>}
            </div>
          </a>
        </Link>
      </div>
    </div>
  );
}

export function Farms() {
  const { data: farms=[], refetch } = trpc.farms.list.useQuery();
  const remove = trpc.farms.delete.useMutation({ onSuccess:()=>refetch() });
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar/>
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fincas</h1>
            <p className="text-sm text-gray-500 mt-1">{farms.length} finca{farms.length!==1?"s":""} registrada{farms.length!==1?"s":""}</p>
          </div>
          <button onClick={()=>setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
            <Plus className="w-4 h-4"/> Nueva ficha de finca
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {farms.map(farm => (
            <FarmCard key={farm.id} farm={farm} onDelete={() => remove.mutate({ id: farm.id })} />
          ))}
          {farms.length===0 && (
            <div className="col-span-3 text-center py-16">
              <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-3"/>
              <p className="text-gray-400 mb-4">No hay fincas registradas</p>
              <button onClick={()=>setShowModal(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Crear primera ficha</button>
            </div>
          )}
        </div>
      </main>
      {showModal && <Modal onClose={()=>setShowModal(false)} onSaved={()=>refetch()}/>}
    </div>
  );
}

export default Farms;

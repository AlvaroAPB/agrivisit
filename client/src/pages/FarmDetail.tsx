import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { trpc } from "../lib/trpc";
import { useParams } from "wouter";
import { format } from "date-fns";
import { Pencil, X, Save, Loader2, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";
import MapaSatelite from "../components/MapaSatelite";
import PestanaClima from "../components/PestanaClima";
import ParcelasSection from "../components/ParcelasSection";

import { CATALOGO, type RangoFoliar } from "../lib/catalogo";

const PAISES = ["España","Portugal","Marruecos","Perú","Sudáfrica"];
const SISTEMAS_RIEGO = ["Goteo","Microaspersión","Aspersión","Secano","Mixto"];
const TIPOS_GOTERO = ["Gotero integrado autocompensante","Gotero integrado no compensante","Gotero pinchado","Difusor","Microaspersor","Cinta de exudación"];
const TIPOS_SUELO = ["Franco","Franco-arcilloso","Arcilloso","Franco-arenoso","Arenoso","Limoso","Otro"];
const ORIGENES_AGUA = ["Pozo propio","Acequia / Canal","Embalse","Red de riego","Mixto"];
const PENDIENTES = ["Llano (0-2%)","Suave (2-5%)","Moderada (5-15%)","Fuerte (>15%)"];
const SECCIONES = ["Identificación","Cultivo","Suelo y agua"];

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

const ic = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";
const sc = ic + " bg-white";

function F({ label, req, children, hint }: { label: string; req?: boolean; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}{req && <span className="text-red-400 ml-1">*</span>}</label>
      {children}
      {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
    </div>
  );
}

function normalize(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}
function valuesMatch(user: string, official: string): boolean {
  if (!official) return true;
  if (!user) return false;
  return normalize(user) === normalize(official);
}

function ValidationHint({ user, official, onApply }: { user: string; official: string; onApply?: () => void }) {
  if (!official) return null;
  if (valuesMatch(user, official)) {
    return <div className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle2 className="w-3 h-3" /><span>Coincide con el mapa</span></div>;
  }
  return (
    <div className="flex items-center gap-1 text-amber-600 text-xs">
      <AlertTriangle className="w-3 h-3" />
      <span>El mapa detecta: </span>
      <button onClick={onApply} className="font-semibold underline hover:text-amber-800">{official}</button>
      <span className="text-amber-500">← pulsa para aplicar</span>
    </div>
  );
}

function normalizeSuperficie(s: string): string {
  return (s || "").replace(/[hHaA ]/g, "").replace(",", ".");
}

interface FF {
  name:string; pais:string; region:string; municipio:string; refCatastral:string;
  lat:string; lng:string; altitud:string; superficie:string; encargado:string; telEncargado:string;
  polygon: number[][] | null;
  paisOficial:string; regionOficial:string; municipioOficial:string;
  especie:string; variedad:string; anyoPlantacion:string; anyoProduccion:string;
  distLineas:string; distPlantas:string; densidad:string; conduccion:string;
  portainjerto:string; nPlantas:string; requerimientoFrio:string;
  tipoSuelo:string; ph:string; materiaOrganica:string; analisisSuelo:string;
  sistemaRiego:string; tipoGotero:string; caudalGotero:string; distGoteros:string;
  origenAgua:string; dotacionAgua:string; pendiente:string;
  observaciones:string;
}

function EditModal({ farm, onClose, onSaved }: { farm: any; onClose: () => void; onSaved: () => void }) {
  let existing: any = {};
  try { existing = JSON.parse(farm.description || "{}"); } catch {}

  const [step, setStep] = useState(0);
  const [f, setF] = useState<FF>({
    name: farm.name || "",
    pais: existing.pais || "España",
    region: existing.region || "",
    municipio: existing.municipio || "",
    refCatastral: existing.refCatastral || "",
    lat: existing.lat || (farm.latitude ? String(farm.latitude) : ""),
    lng: existing.lng || (farm.longitude ? String(farm.longitude) : ""),
    altitud: existing.altitud || "",
    superficie: existing.superficie || farm.totalHectares || "",
    encargado: existing.encargado || "",
    telEncargado: existing.telEncargado || "",
    polygon: existing.polygon || null,
    paisOficial: existing.paisOficial || "",
    regionOficial: existing.regionOficial || "",
    municipioOficial: existing.municipioOficial || "",
    especie: existing.especie || "",
    variedad: existing.variedad || "",
    anyoPlantacion: existing.anyoPlantacion || "",
    anyoProduccion: existing.anyoProduccion || "",
    distLineas: existing.distLineas || "",
    distPlantas: existing.distPlantas || "",
    densidad: existing.densidad || "",
    conduccion: existing.conduccion || "",
    portainjerto: existing.portainjerto || "",
    nPlantas: existing.nPlantas || "",
    requerimientoFrio: existing.requerimientoFrio || "",
    tipoSuelo: existing.tipoSuelo || "",
    ph: existing.ph || "",
    materiaOrganica: existing.materiaOrganica || "",
    analisisSuelo: existing.analisisSuelo || "No",
    sistemaRiego: existing.sistemaRiego || "",
    tipoGotero: existing.tipoGotero || "",
    caudalGotero: existing.caudalGotero || "",
    distGoteros: existing.distGoteros || "",
    origenAgua: existing.origenAgua || "",
    dotacionAgua: existing.dotacionAgua || "",
    pendiente: existing.pendiente || "",
    observaciones: existing.observaciones || "",
  });
  const [validating, setValidating] = useState(false);
  const [coordInput, setCoordInput] = useState(
    (existing?.lat && existing?.lng) ? `${existing.lat}, ${existing.lng}` : ""
  );
  const [coordError, setCoordError] = useState("");
  const [dotacionUnit, setDotacionUnit] = useState<"m3" | "mm">("m3");

  const update = trpc.farms.update.useMutation({ onSuccess: () => { onSaved(); onClose(); } });
  const set = (k: keyof FF) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF(p => ({ ...p, [k]: e.target.value }));

  // Conversor de coordenadas
  function parseCoords(raw: string) {
    const s = raw.trim();
    const decimal = s.match(/^(-?\d+[.,]?\d*)[,;\s]+(-?\d+[.,]?\d*)$/);
    if (decimal) return { lat: parseFloat(decimal[1].replace(",", ".")), lng: parseFloat(decimal[2].replace(",", ".")) };
    const gms = s.match(/(\d+)[°º](\d+)[''′]?(\d+(?:[.,]\d+)?)[""″]?\s*([NS])[,;\s]+(\d+)[°º](\d+)[''′]?(\d+(?:[.,]\d+)?)[""″]?\s*([EWOo])/i);
    if (gms) {
      const lat = (parseInt(gms[1]) + parseInt(gms[2])/60 + parseFloat(gms[3])/3600) * (gms[4].toUpperCase() === "S" ? -1 : 1);
      const lng = (parseInt(gms[5]) + parseInt(gms[6])/60 + parseFloat(gms[7])/3600) * ("WwOo".includes(gms[8]) ? -1 : 1);
      return { lat, lng };
    }
    return null;
  }

  function handleCoordInput(raw: string) {
    setCoordInput(raw);
    const parsed = parseCoords(raw);
    if (parsed) {
      setCoordError("");
      setF(p => ({ ...p, lat: String(parsed.lat), lng: String(parsed.lng) }));
    } else if (raw.length > 5) {
      setCoordError("Formato no reconocido. Usa: 36.7234, -4.4215");
    } else {
      setCoordError("");
    }
  }

  function toDMS(dd: number, isLat: boolean) {
    const abs = Math.abs(dd);
    const d = Math.floor(abs);
    const m = Math.floor((abs - d) * 60);
    const s = ((abs - d - m/60) * 3600).toFixed(1);
    const dir = isLat ? (dd >= 0 ? "N" : "S") : (dd >= 0 ? "E" : "W");
    return `${d}°${m}'${s}"${dir}`;
  }

  // VALIDACIÓN AL VUELO al abrir el modal: si tiene coordenadas pero no datos oficiales, hacer reverse geocoding
  useEffect(() => {
    if (!f.paisOficial && f.lat && f.lng) {
      setValidating(true);
      const fetchOfficial = async () => {
        try {
          const url = `https://api.maptiler.com/geocoding/${f.lng},${f.lat}.json?key=XgBpftLrirF6DzSrbFzv&language=es`;
          const res = await fetch(url);
          const data = await res.json();
          const feature = data.features?.[0];
          if (feature) {
            let municipio = "", region = "", paisFound = "";
            if (feature.context) {
              for (const ctx of feature.context as any[]) {
                if (ctx.id?.startsWith("municipality") || ctx.id?.startsWith("place")) municipio = ctx.text;
                else if (ctx.id?.startsWith("region") || ctx.id?.startsWith("subregion")) region = ctx.text;
                else if (ctx.id?.startsWith("country")) paisFound = ctx.text;
              }
            }
            if (!municipio && feature.place_type?.includes("place")) municipio = feature.text;

            setF(p => ({
              ...p,
              paisOficial: paisFound,
              regionOficial: region,
              municipioOficial: municipio,
            }));
          }
        } catch (e) { console.error(e); }
        setValidating(false);
      };
      fetchOfficial();
    }
  }, []);

  const hasOfficial = !!(f.paisOficial || f.regionOficial || f.municipioOficial);
  const allMatch = valuesMatch(f.pais, f.paisOficial) && valuesMatch(f.region, f.regionOficial) && valuesMatch(f.municipio, f.municipioOficial);
  const showWarning = hasOfficial && !allMatch;

  const restoreFromMap = () => {
    setF(p => ({
      ...p,
      pais: PAISES.includes(p.paisOficial) ? p.paisOficial : p.pais,
      region: p.regionOficial || p.region,
      municipio: p.municipioOficial || p.municipio,
    }));
  };

  const handleSave = () => {
    update.mutate({
      id: farm.id,
      name: f.name,
      location: `${f.municipio}, ${f.region}, ${f.pais}`,
      totalHectares: normalizeSuperficie(f.superficie),
      latitude: f.lat ? parseFloat(f.lat) : undefined,
      longitude: f.lng ? parseFloat(f.lng) : undefined,
      description: JSON.stringify(f),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Editar — {farm.name}</h2>
            <p className="text-sm text-gray-500">{step+1} de {SECCIONES.length} — {SECCIONES[step]}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex px-5 pt-3 gap-1.5">
          {SECCIONES.map((_, i) => <div key={i} className={`flex-1 h-1.5 rounded-full ${i <= step ? "bg-green-500" : "bg-gray-100"}`} />)}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === 0 && <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><F label="Nombre de la finca" req><input value={f.name} onChange={set("name")} className={ic} /></F></div>

            {validating && (
              <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-2 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                <p className="text-xs text-blue-800">Validando con datos del mapa...</p>
              </div>
            )}

            {showWarning && !validating && (
              <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 text-sm">
                  <p className="font-medium text-amber-900">Discrepancia con los datos del mapa</p>
                  <p className="text-amber-700 text-xs mt-0.5">Los datos del mapa son los oficiales. Pulsa para restaurar.</p>
                </div>
                <button onClick={restoreFromMap} className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs hover:bg-amber-700">
                  <RotateCcw className="w-3 h-3" /> Restaurar mapa
                </button>
              </div>
            )}
            {hasOfficial && allMatch && !validating && (
              <div className="col-span-2 bg-green-50 border border-green-200 rounded-lg p-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <p className="text-xs text-green-800">Datos verificados con el mapa ✓</p>
              </div>
            )}

            <F label="País" req hint={f.paisOficial && <ValidationHint user={f.pais} official={f.paisOficial} onApply={()=>setF(p=>({...p,pais:PAISES.includes(p.paisOficial)?p.paisOficial:p.pais}))} />}>
              <select value={f.pais} onChange={e => setF(p => ({ ...p, pais: e.target.value }))} className={sc}>{PAISES.map(p => <option key={p}>{p}</option>)}</select>
            </F>
            <F label="Región / Provincia" req hint={f.regionOficial && <ValidationHint user={f.region} official={f.regionOficial} onApply={()=>setF(p=>({...p,region:p.regionOficial}))} />}>
              <input value={f.region} onChange={set("region")} className={ic} placeholder="Ej: Sevilla, Souss-Massa..." />
            </F>
            <F label="Municipio" req hint={f.municipioOficial && <ValidationHint user={f.municipio} official={f.municipioOficial} onApply={()=>setF(p=>({...p,municipio:p.municipioOficial}))} />}>
              <input value={f.municipio} onChange={set("municipio")} className={ic} placeholder="Ej: La Rinconada" />
            </F>
            <F label="Referencia catastral"><input value={f.refCatastral} onChange={set("refCatastral")} className={ic} /></F>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1 font-medium">
                Coordenadas <span className="text-gray-400 font-normal">(decimal, GMS o UTM)</span>
              </label>
              <input
                value={coordInput}
                onChange={e => handleCoordInput(e.target.value)}
                className={`${ic} ${coordError ? "border-red-300 focus:ring-red-400" : ""}`}
                placeholder="36.7234, -4.4215  ó  36°43N 4°25W"
              />
              {coordError && <p className="text-xs text-red-500 mt-1">{coordError}</p>}
              {f.lat && f.lng && !coordError && (
                <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  <span><span className="text-gray-400">Decimal:</span> {parseFloat(f.lat).toFixed(6)}, {parseFloat(f.lng).toFixed(6)}</span>
                  <span><span className="text-gray-400">GMS:</span> {toDMS(parseFloat(f.lat), true)} {toDMS(parseFloat(f.lng), false)}</span>
                  {f.altitud && <span><span className="text-gray-400">Altitud:</span> <strong>{f.altitud} m</strong></span>}
                  <a href={`https://maps.google.com/?q=${f.lat},${f.lng}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline ml-auto">Google Maps →</a>
                </div>
              )}
            </div>
            <F label="Altitud (m)" hint={<span className="text-xs text-gray-400">Auto desde clic en mapa</span>}>
              <input value={f.altitud} onChange={set("altitud")} className={ic} type="number" placeholder="Auto desde clic en mapa" />
            </F>
            <F label="Superficie total (ha)" req
              hint={f.polygon ? <span className="text-green-600 text-xs">✓ Calculada del polígono</span> : <span className="text-xs text-gray-400">Manual — usa coma o punto (ej: 45.5)</span>}>
              <input value={f.superficie}
                onChange={e => setF(p => ({...p, superficie: normalizeSuperficie(e.target.value)}))}
                onBlur={e => setF(p => ({...p, superficie: normalizeSuperficie(e.target.value)}))}
                className={ic} placeholder="Ej: 45.5" />
            </F>
            <F label="Encargado de campo"><input value={f.encargado} onChange={set("encargado")} className={ic} /></F>
            <F label="Teléfono encargado"><input value={f.telEncargado} onChange={set("telEncargado")} className={ic} /></F>
            <MapaSatelite lat={f.lat} lng={f.lng} pais={f.pais}
              initialPolygon={f.polygon}
              onSelect={(la, lo) => setF(p => ({ ...p, lat: String(la), lng: String(lo) }))}
              onLocationFound={(info) => setF(p => ({
                ...p,
                municipio: info.municipio || p.municipio,
                region: info.region || p.region,
                pais: PAISES.includes(info.pais || "") ? (info.pais as string) : p.pais,
                altitud: info.altitud || p.altitud,
                municipioOficial: info.municipio || p.municipioOficial,
                regionOficial: info.region || p.regionOficial,
                paisOficial: info.pais || p.paisOficial,
              }))}
              onPolygonChange={(info) => setF(p => ({
                ...p,
                polygon: info.polygon,
                superficie: info.areaHa != null ? info.areaHa.toFixed(2) : p.superficie,
              }))} />
          </div>}

          {step === 1 && (() => {
            const especieCat = CATALOGO.find(e => e.nombre === f.especie);
            const variedadCat = especieCat?.variedades.find(v => v.nombre === f.variedad);
            const grupoCat = especieCat?.grupo ?? "";
            const conducciones = getConductionOptions(grupoCat);
            return (
            <div className="grid grid-cols-2 gap-4">
              <F label="Especie">
                <select value={f.especie} onChange={e => setF(p => ({
                  ...p, especie: e.target.value, variedad: "", portainjerto: "", conduccion: "", requerimientoFrio: ""
                }))} className={sc}>
                  <option value="">Selecciona especie...</option>
                  {CATALOGO.map(esp => <option key={esp.nombre} value={esp.nombre}>{esp.nombre}</option>)}
                </select>
              </F>
              <F label="Variedad" hint={!f.especie ? "Selecciona primero la especie" : undefined}>
                <select value={f.variedad} onChange={e => {
                  const v = especieCat?.variedades.find(x => x.nombre === e.target.value);
                  setF(p => ({
                    ...p,
                    variedad: e.target.value,
                    portainjerto: v?.portainjertosRec?.[0] ?? p.portainjerto,
                    conduccion: v?.conduccionRec?.split("/")[0].trim() ?? p.conduccion,
                    requerimientoFrio: v?.chillPortions?.toString() ?? v?.chillHours?.toString() ?? p.requerimientoFrio,
                  }));
                }} className={sc} disabled={!f.especie}>
                  <option value="">{f.especie ? "Selecciona variedad..." : "— elige especie primero —"}</option>
                  {especieCat?.variedades.map(v => (
                    <option key={v.id} value={v.nombre}>{v.nombre}{v.protegida ? " ®" : ""}</option>
                  ))}
                </select>
              </F>

              {variedadCat && (
                <div className="col-span-2 bg-green-50 border border-green-200 rounded-lg p-3 flex flex-wrap gap-2 text-xs">
                  <span className="font-medium text-green-800">{variedadCat.nombre}</span>
                  {variedadCat.chillPortions && <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{variedadCat.chillPortions} CP</span>}
                  {variedadCat.chillHours && <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{variedadCat.chillHours} h frío</span>}
                  {variedadCat.calibreOptMm && <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">Calibre {variedadCat.calibreOptMm}mm</span>}
                  {variedadCat.brixOpt && <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">{variedadCat.brixOpt}° Brix</span>}
                  {variedadCat.densidadRec && <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">{variedadCat.densidadRec}</span>}
                </div>
              )}

              <F label="Año de plantación"><input value={f.anyoPlantacion} onChange={set("anyoPlantacion")} className={ic} type="number" /></F>
              <F label="Año entrada en producción"><input value={f.anyoProduccion} onChange={set("anyoProduccion")} className={ic} type="number" /></F>

              <F label="Sistema de conducción" hint={grupoCat ? <span className="text-green-600">Opciones para {especieCat?.nombre}</span> : undefined}>
                <select value={f.conduccion} onChange={set("conduccion")} className={sc}>
                  <option value="">Selecciona...</option>
                  {conducciones.map(s => <option key={s}>{s}</option>)}
                </select>
              </F>
              <F label="Portainjerto" hint={variedadCat?.portainjertosRec && <span className="text-green-600">Rec: {variedadCat.portainjertosRec.join(", ")}</span>}>
                <input value={f.portainjerto} onChange={set("portainjerto")} className={ic}
                  placeholder={variedadCat?.portainjertosRec?.[0] ?? "Ej: GF677"} />
              </F>

              <F label="Distancia entre líneas (m)">
                <input value={f.distLineas} onChange={e => { const v = e.target.value; setF(p => { const dl = parseFloat(v); const dp = parseFloat(p.distPlantas); const dens = dl > 0 && dp > 0 ? Math.round(10000 / (dl * dp)) : parseFloat(p.densidad); const sup = parseFloat(p.superficie); return { ...p, distLineas: v, densidad: dl > 0 && dp > 0 ? String(dens) : p.densidad, nPlantas: dens > 0 && sup > 0 ? String(Math.round(dens * sup)) : p.nPlantas }; }); }} className={ic} type="number" step="0.1" />
              </F>
              <F label="Distancia entre plantas (m)">
                <input value={f.distPlantas} onChange={e => { const v = e.target.value; setF(p => { const dl = parseFloat(p.distLineas); const dp = parseFloat(v); const dens = dl > 0 && dp > 0 ? Math.round(10000 / (dl * dp)) : parseFloat(p.densidad); const sup = parseFloat(p.superficie); return { ...p, distPlantas: v, densidad: dl > 0 && dp > 0 ? String(dens) : p.densidad, nPlantas: dens > 0 && sup > 0 ? String(Math.round(dens * sup)) : p.nPlantas }; }); }} className={ic} type="number" step="0.1" />
              </F>
              <F label="Densidad (plantas/ha)">
                <div className={`${ic} bg-green-50 text-green-700 font-medium`}>{f.densidad ? `${f.densidad}` : "Auto"}</div>
              </F>
              <F label="Nº total de plantas">
                <input value={f.nPlantas} onChange={set("nPlantas")} className={ic} type="number" placeholder={f.densidad && f.superficie ? String(Math.round(parseFloat(f.densidad) * parseFloat(f.superficie))) : ""} />
              </F>

              <div className="col-span-2 border-t border-gray-100 pt-3 mt-2">
                <p className="text-xs text-gray-500 mb-2">Datos para predicción climática</p>
                <F label="Requerimiento de frío"
                  hint={variedadCat?.chillPortions
                    ? <span className="text-green-600">✓ Del catálogo — {variedadCat.chillPortions} CP</span>
                    : variedadCat?.chillHours
                    ? <span className="text-green-600">✓ Del catálogo — {variedadCat.chillHours} h frío</span>
                    : grupoCat === "hueso" ? "Chill Portions (CP)" : "Horas de frío"}>
                  <input value={f.requerimientoFrio} onChange={set("requerimientoFrio")} className={ic} type="number" />
                </F>
              </div>
            </div>
          );})()}

          {step === 2 && <div className="grid grid-cols-2 gap-4">
            <F label="Tipo de suelo"><select value={f.tipoSuelo} onChange={set("tipoSuelo")} className={sc}><option value="">Selecciona...</option>{TIPOS_SUELO.map(s => <option key={s}>{s}</option>)}</select></F>
            <F label="Pendiente"><select value={f.pendiente} onChange={set("pendiente")} className={sc}><option value="">Selecciona...</option>{PENDIENTES.map(p => <option key={p}>{p}</option>)}</select></F>
            <F label="pH"><input value={f.ph} onChange={set("ph")} className={ic} type="number" step="0.1" /></F>
            <F label="Materia orgánica (%)"><input value={f.materiaOrganica} onChange={set("materiaOrganica")} className={ic} type="number" step="0.1" /></F>
            <F label="Análisis de suelo"><select value={f.analisisSuelo} onChange={set("analisisSuelo")} className={sc}><option>No</option><option>Sí — reciente (menos de 2 años)</option><option>Sí — antiguo (más de 2 años)</option></select></F>
            <F label="Sistema de riego"><select value={f.sistemaRiego} onChange={set("sistemaRiego")} className={sc}><option value="">Selecciona...</option>{SISTEMAS_RIEGO.map(s => <option key={s}>{s}</option>)}</select></F>
            {(f.sistemaRiego === "Goteo" || f.sistemaRiego === "Microaspersión") && <>
              <F label="Tipo de emisor"><select value={f.tipoGotero} onChange={set("tipoGotero")} className={sc}><option value="">Selecciona...</option>{TIPOS_GOTERO.map(t => <option key={t}>{t}</option>)}</select></F>
              <F label="Caudal (l/h)"><input value={f.caudalGotero} onChange={set("caudalGotero")} className={ic} type="number" step="0.1" /></F>
              <F label="Distancia emisores (m)"><input value={f.distGoteros} onChange={set("distGoteros")} className={ic} type="number" step="0.05" /></F>
            </>}
            <F label="Origen del agua"><select value={f.origenAgua} onChange={set("origenAgua")} className={sc}><option value="">Selecciona...</option>{ORIGENES_AGUA.map(o => <option key={o}>{o}</option>)}</select></F>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500 font-medium">Dotación agua</label>
                <div className="flex gap-0.5 bg-gray-100 rounded-md p-0.5">
                  {(["m3", "mm"] as const).map(u => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => {
                        if (u === dotacionUnit) return;
                        setDotacionUnit(u);
                        if (f.dotacionAgua) {
                          const v = parseFloat(f.dotacionAgua);
                          if (!isNaN(v)) {
                            // m³/ha ÷ 10 = mm  |  mm × 10 = m³/ha
                            setF(p => ({ ...p, dotacionAgua: u === "mm" ? (v / 10).toFixed(1) : (v * 10).toFixed(0) }));
                          }
                        }
                      }}
                      className={`px-2 py-0.5 text-xs rounded transition-all ${dotacionUnit === u ? "bg-white shadow text-gray-900 font-medium" : "text-gray-500 hover:text-gray-700"}`}
                    >
                      {u === "m3" ? "m³/ha" : "mm"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <input
                  value={f.dotacionAgua}
                  onChange={set("dotacionAgua")}
                  className={ic}
                  type="number"
                  placeholder={dotacionUnit === "m3" ? "Ej: 9000" : "Ej: 900"}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                  {dotacionUnit === "m3" ? "m³/ha/año" : "mm/año"}
                </span>
              </div>
              {f.dotacionAgua && (
                <p className="text-xs text-gray-400 mt-1">
                  ≈ {dotacionUnit === "m3"
                    ? `${(parseFloat(f.dotacionAgua) / 10).toFixed(1)} mm/año`
                    : `${(parseFloat(f.dotacionAgua) * 10).toFixed(0)} m³/ha/año`}
                </p>
              )}
            </div>
            <div className="col-span-2"><F label="Observaciones"><textarea value={f.observaciones} onChange={set("observaciones")} className={`${ic} resize-none`} rows={3} /></F></div>
            {update.error && <p className="col-span-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{update.error.message}</p>}
          </div>}
        </div>

        <div className="p-4 border-t border-gray-100 flex items-center justify-between">
          <button onClick={() => setStep(s => s - 1)} disabled={step === 0} className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>
          <span className="text-xs text-gray-400">{step + 1} / {SECCIONES.length}</span>
          {step < SECCIONES.length - 1
            ? <button onClick={() => setStep(s => s + 1)} className="flex items-center gap-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">Siguiente <ChevronRight className="w-4 h-4" /></button>
            : <button onClick={handleSave} disabled={update.isPending} className="flex items-center gap-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              {update.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : <><Save className="w-4 h-4" /> Guardar cambios</>}
            </button>
          }
        </div>
      </div>
    </div>
  );
}

export default function FarmDetail() {
  const { id } = useParams<{ id: string }>();
  const farmId = parseInt(id);
  const { data: farm, refetch: refetchFarm } = trpc.farms.getById.useQuery({ id: farmId });
  const { data: reviews = [], refetch: refetchReviews } = trpc.reviews.listByFarm.useQuery({ farmId });
  const { data: crops = [] } = trpc.crops.listByFarm.useQuery({ farmId });
  const createReview = trpc.reviews.create.useMutation({ onSuccess: () => refetchReviews() });
  const deleteReview = trpc.reviews.delete.useMutation({ onSuccess: () => refetchReviews() });
  const [showEdit, setShowEdit] = useState(false);
  const [tab, setTab] = useState<"resumen" | "clima">("resumen");

  let extra: any = {};
  try { extra = JSON.parse(farm?.description || "{}"); } catch {}

  if (!farm) return <div className="flex min-h-screen"><Sidebar /><main className="flex-1 flex items-center justify-center"><p className="text-gray-400">Cargando...</p></main></div>;

  // Detectar discrepancias de datos guardados (si hay paisOficial guardado)
  const hasDiscrepancy = extra.paisOficial && (
    !valuesMatch(extra.pais || "", extra.paisOficial) ||
    !valuesMatch(extra.region || "", extra.regionOficial || "") ||
    !valuesMatch(extra.municipio || "", extra.municipioOficial || "")
  );

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{farm.name}</h1>
            <p className="text-gray-500 text-sm mt-1">{farm.location} · {farm.totalHectares} ha</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {extra.especie && <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-full">{extra.especie}</span>}
              {extra.variedad && <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">{extra.variedad}</span>}
              {extra.sistemaRiego && <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full">{extra.sistemaRiego}</span>}
              {hasDiscrepancy && <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded-full flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Datos sin verificar con mapa</span>}
            </div>
          </div>
          <button onClick={() => setShowEdit(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
            <Pencil className="w-4 h-4" /> Editar ficha
          </button>
        </div>

        <div className="flex border-b border-gray-200 mb-6">
          <button onClick={() => setTab("resumen")} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "resumen" ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>Resumen</button>
          <button onClick={() => setTab("clima")} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === "clima" ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>Clima</button>
        </div>

        {tab === "resumen" && <>
          {(extra.distLineas || extra.densidad || extra.conduccion) && (
            <div className="grid grid-cols-4 gap-3 mb-6">
              {extra.densidad && <div className="bg-white rounded-xl border border-gray-100 p-4"><p className="text-xs text-gray-500 mb-1">Densidad</p><p className="font-semibold text-gray-900">{extra.densidad} pl/ha</p></div>}
              {extra.distLineas && extra.distPlantas && <div className="bg-white rounded-xl border border-gray-100 p-4"><p className="text-xs text-gray-500 mb-1">Marco</p><p className="font-semibold text-gray-900">{extra.distLineas}×{extra.distPlantas} m</p></div>}
              {extra.conduccion && <div className="bg-white rounded-xl border border-gray-100 p-4"><p className="text-xs text-gray-500 mb-1">Conducción</p><p className="font-semibold text-gray-900">{extra.conduccion}</p></div>}
              {extra.anyoPlantacion && <div className="bg-white rounded-xl border border-gray-100 p-4"><p className="text-xs text-gray-500 mb-1">Año plantación</p><p className="font-semibold text-gray-900">{extra.anyoPlantacion}</p></div>}
            </div>
          )}

          <div className="mb-6">
            <ParcelasSection farmId={farmId} />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="p-4 border-b border-gray-100"><h2 className="font-semibold text-gray-900">Cultivos ({crops.length})</h2></div>
              <div className="p-4 space-y-2">
                {crops.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                    <div>
                      <p className="font-medium text-sm text-gray-900">{c.species} {c.variety && `— ${c.variety}`}</p>
                      <p className="text-xs text-gray-500">{c.surface} ha · {c.plantingYear}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${c.status === "activo" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{c.status}</span>
                  </div>
                ))}
                {crops.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Sin cultivos</p>}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Revisiones ({reviews.length})</h2>
                <button onClick={() => createReview.mutate({ farmId, cropStatus: "Bueno", generalObservations: "Nueva revisión" })} className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700">+ Nueva</button>
              </div>
              <div className="p-4 space-y-2">
                {reviews.map(r => (
                  <div key={r.id} className="flex items-start justify-between py-2 border-b border-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{format(new Date(r.createdAt), "dd/MM/yyyy")}</p>
                      <p className="text-xs text-gray-500 truncate max-w-[180px]">{r.generalObservations || "Sin observaciones"}</p>
                    </div>
                    <button onClick={() => deleteReview.mutate({ id: r.id })} className="text-xs px-2 py-1 bg-red-50 text-red-500 rounded hover:bg-red-100">✕</button>
                  </div>
                ))}
                {reviews.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Sin revisiones</p>}
              </div>
            </div>
          </div>
        </>}

        {tab === "clima" && (
          <PestanaClima
            farmId={farmId}
            requerimientoFrio={extra.requerimientoFrio ? parseFloat(extra.requerimientoFrio) : undefined}
            variedad={extra.variedad}
          />
        )}
      </main>

      {showEdit && farm && <EditModal farm={farm} onClose={() => setShowEdit(false)} onSaved={() => refetchFarm()} />}
    </div>
  );
}

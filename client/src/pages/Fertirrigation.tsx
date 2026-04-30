import { useState, useMemo, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { trpc } from "../lib/trpc";
import { CATALOGO, FERTILIZANTES, getAllVariedades, getEspecieByNombre, type Variedad, type RangoFoliar } from "../lib/catalogo";
import { FlaskConical, AlertTriangle, CheckCircle2, RotateCcw, Calculator, ChevronDown, ChevronUp, Pencil, Tag } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type PreciosMap = Record<string, number>;
function initPrecios(): PreciosMap {
  const m: PreciosMap = {};
  FERTILIZANTES.forEach(f => { m[f.nombre] = f.precioKg; });
  return m;
}

type Elemento = "N" | "P" | "K" | "Ca" | "Mg" | "Fe" | "Mn" | "Zn" | "B" | "Cu";
const ELEMENTOS: Elemento[] = ["N", "P", "K", "Ca", "Mg", "Fe", "Mn", "Zn", "B", "Cu"];
const UNIDADES: Record<Elemento, string> = { N: "%", P: "%", K: "%", Ca: "%", Mg: "%", Fe: "ppm", Mn: "ppm", Zn: "ppm", B: "ppm", Cu: "ppm" };

function normalize(s: string) { return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[®™°·]/g, "").replace(/\s+/g, " ").trim(); }

function getEstado(val: number, rango: [number, number]): "deficiente" | "optimo" | "exceso" | "leve" {
  if (val <= 0) return "optimo";
  if (val < rango[0] * 0.8) return "deficiente";
  if (val < rango[0]) return "leve";
  if (val > rango[1] * 1.1) return "exceso";
  if (val > rango[1]) return "leve";
  return "optimo";
}

const ESTADO_COLOR: Record<string, string> = {
  deficiente: "bg-red-100 text-red-800 border-red-200",
  leve: "bg-amber-100 text-amber-800 border-amber-200",
  optimo: "bg-green-100 text-green-800 border-green-200",
  exceso: "bg-orange-100 text-orange-800 border-orange-200",
};

export default function Fertirrigation() {
  const { data: farms = [] } = trpc.farms.list.useQuery();
  const allVars = getAllVariedades();

  // ── Selección de finca y variedad ──────────────────────────────
  const [farmId, setFarmId] = useState<number | "">("");
  const [variedadId, setVarId] = useState<string>("");
  const [selectedCropId, setSelectedCropId] = useState<number | "">("");
  const [produccionKgHa, setProduccion] = useState<number>(15000);
  const [superficie, setSuperficie] = useState<number>(10);

  // Cargar cultivos activos de la finca seleccionada
  const { data: farmCrops = [] } = trpc.crops.listByFarm.useQuery(
    { farmId: farmId as number },
    { enabled: typeof farmId === "number" && farmId > 0 }
  );
  const activeCrops = farmCrops.filter(c => c.status === "activo");

  const farm = farms.find(f => f.id === farmId);
  let farmExtra: any = {};
  try { farmExtra = JSON.parse(farm?.description || "{}"); } catch {}

  const variedad = allVars.find(v => v.id === variedadId);
  const especie = variedad ? getEspecieByNombre(variedad.especie) : null;

  // ── Parámetros de suelo ────────────────────────────────────────
  const [ph, setPh] = useState<number>(parseFloat(farmExtra.ph) || 7.0);
  const [ce, setCe] = useState<number>(parseFloat(farmExtra.ce) || 0.8);
  const [mo, setMo] = useState<number>(parseFloat(farmExtra.materiaOrganica) || 1.5);

  // ── Análisis foliar (valores lab.) ────────────────────────────
  const [foliar, setFoliar] = useState<Record<Elemento, number>>({ N:0,P:0,K:0,Ca:0,Mg:0,Fe:0,Mn:0,Zn:0,B:0,Cu:0 });
  const [editFoliar, setEditFoliar] = useState(true);

  // ── Rangos editables (inicializados desde catálogo) ───────────
  const [rangos, setRangos] = useState<RangoFoliar | null>(null);
  const activeRangos = rangos ?? variedad?.rangoFoliar ?? null;

  // ── Precios dinámicos de fertilizantes ────────────────────────
  const [precios, setPrecios] = useState<PreciosMap>(initPrecios);
  const [showPrecios, setShowPrecios] = useState(false);

  // ── Rellenar variedad/superficie desde cultivo ─────────────────
  function autoFillFromCrop(crop: typeof farmCrops[0]) {
    const searchTerm = normalize(crop.variety || crop.species || "");
    const match = allVars.find(v =>
      normalize(v.nombre) === searchTerm ||
      normalize(v.nombre).includes(searchTerm) ||
      searchTerm.includes(normalize(v.nombre))
    );
    if (match) {
      setVarId(match.id);
      setRangos(null);
      setProduccion(
        crop.expectedProduction
          ? Math.round(parseFloat(crop.expectedProduction))
          : match.rendimientoBaseKgHa ?? 15000
      );
    } else {
      setVarId("");
    }
    if (crop.surface) setSuperficie(parseFloat(crop.surface));
  }

  // Auto-rellenar al cargar cultivos de la finca
  useEffect(() => {
    if (activeCrops.length === 0) return;
    const crop = activeCrops[0];
    setSelectedCropId(crop.id);
    autoFillFromCrop(crop);
  }, [farmCrops]);

  // Cambio de cultivo manual (cuando hay varios en la finca)
  const handleCropChange = (cropId: number | "") => {
    setSelectedCropId(cropId);
    if (cropId === "") { setVarId(""); setSuperficie(10); return; }
    const crop = farmCrops.find(c => c.id === cropId);
    if (crop) autoFillFromCrop(crop);
  };

  // Reset completo al cambiar de finca + auto-relleno desde ficha
  const handleFarmChange = (id: number | "") => {
    setFarmId(id);
    setSelectedCropId("");
    setVarId("");
    setRangos(null);
    setProduccion(15000);
    setSuperficie(10);

    if (!id) return;
    const selectedFarm = farms.find(f => f.id === id);
    let extra: any = {};
    try { extra = JSON.parse(selectedFarm?.description || "{}"); } catch {}

    // Rellenar superficie desde la ficha
    const supFicha = extra.superficie || selectedFarm?.totalHectares;
    if (supFicha) setSuperficie(parseFloat(String(supFicha)));

    // Buscar variedad en catálogo por nombre (extra.variedad) o especie (extra.especie)
    const varSearch = normalize(extra.variedad || "");
    const espSearch = normalize(extra.especie || "");
    const match = allVars.find(v =>
      (varSearch && (normalize(v.nombre) === varSearch || normalize(v.nombre).includes(varSearch) || varSearch.includes(normalize(v.nombre)))) ||
      (espSearch && normalize(v.especie) === espSearch)
    );
    if (match) {
      setVarId(match.id);
      setProduccion(match.rendimientoBaseKgHa ?? 15000);
    }
  };

  // Resetear rangos al cambiar variedad manualmente
  const selectVariedad = (id: string) => {
    setVarId(id);
    setRangos(null);
    const v = allVars.find(x => x.id === id);
    if (v) setProduccion(v.rendimientoBaseKgHa ?? 15000);
  };

  // ── Diagnóstico foliar ─────────────────────────────────────────
  const diagnostico = useMemo(() => {
    if (!activeRangos) return [];
    return ELEMENTOS.map(elem => {
      const val = foliar[elem];
      const rango = (activeRangos as any)[elem] as [number, number];
      const estado = getEstado(val, rango);
      return { elem, val, rango, estado };
    }).filter(d => d.val > 0 || true); // mostrar todos
  }, [foliar, activeRangos]);

  // ── Alertas suelo ──────────────────────────────────────────────
  const alertas: string[] = [];
  if (ph > 7.2) alertas.push(`pH alto (${ph}) — Fe, Mn, Zn quedan inmovilizados. Aplicar azufre o ácidos.`);
  if (ph < 5.8) alertas.push(`pH ácido (${ph}) — Riesgo toxicidad Mn y Al. Encalar.`);
  if (ce > 1.5) alertas.push(`CE agua alta (${ce} dS/m) — Salinidad compite con absorción Ca y K. Fraccionar riegos.`);
  if (mo < 1.0) alertas.push(`MO baja (${mo}%) — CIC reducida. Considerar enmiendas orgánicas.`);
  if (ph > 7.0 && foliar.Fe > 0 && foliar.Fe < activeRangos?.Fe[0]! ) alertas.push("Deficiencia Fe en suelo calcáreo: usar Quelato EDDHA (resistente a pH alto).");

  // ── Plan NPK base (extracción × producción) ───────────────────
  const planBase = useMemo(() => {
    if (!variedad) return null;
    const ext = variedad.extraccion;
    const t = produccionKgHa / 1000;
    // Corrección por MO: +1% MO aporta ~25 kg N/ha disponible
    const nSuelo = Math.round(mo * 25);
    // Corrección CE: CE>1.5 reduce absorción K 10-20%
    const kFactor = ce > 1.5 ? 1.2 : ce > 1.0 ? 1.1 : 1.0;
    return {
      N: Math.round(ext.N * t - nSuelo * 0.3),
      P2O5: Math.round(ext.P2O5 * t),
      K2O: Math.round(ext.K2O * t * kFactor),
      CaO: Math.round(ext.CaO * t),
      MgO: Math.round(ext.MgO * t),
    };
  }, [variedad, produccionKgHa, mo, ce]);

  // ── Plan por fenofases ─────────────────────────────────────────
  const planFenofases = useMemo(() => {
    if (!planBase || !especie) return [];
    return especie.fenofasesNPK.map(f => ({
      ...f,
      N_kg: Math.round(planBase.N * f.porcentajeN / 100),
      P_kg: Math.round(planBase.P2O5 * f.porcentajeP / 100),
      K_kg: Math.round(planBase.K2O * f.porcentajeK / 100),
    }));
  }, [planBase, especie]);

  // ── Optimización fertilizantes ────────────────────────────────
  const planFertilizantes = useMemo(() => {
    if (!planBase) return [];
    const total = { N: planBase.N * superficie, P: planBase.P2O5 * superficie, K: planBase.K2O * superficie };
    const rec: { f: typeof FERTILIZANTES[0]; kgHa: number; kgTotal: number; coste: number }[] = [];

    // Estrategia simple: cubrir P con MAP, K con SOP+NKP, N con CA-NO3+AN
    const mapKgHa = Math.round(planBase.P2O5 / 0.61);
    rec.push({ f: FERTILIZANTES[2], kgHa: mapKgHa, kgTotal: mapKgHa * superficie, coste: mapKgHa * superficie * (precios[FERTILIZANTES[2].nombre] ?? FERTILIZANTES[2].precioKg) });

    const nFromMap = mapKgHa * 0.12;
    const nRemaining = Math.max(0, planBase.N - nFromMap);
    const caNO3KgHa = Math.round((nRemaining * 0.6) / 0.155);
    rec.push({ f: FERTILIZANTES[1], kgHa: caNO3KgHa, kgTotal: caNO3KgHa * superficie, coste: caNO3KgHa * superficie * (precios[FERTILIZANTES[1].nombre] ?? FERTILIZANTES[1].precioKg) });

    const nFromCa = caNO3KgHa * 0.155;
    const nFinal = Math.max(0, nRemaining - nFromCa);
    const anKgHa = Math.round(nFinal / 0.33);
    if (anKgHa > 0) rec.push({ f: FERTILIZANTES[0], kgHa: anKgHa, kgTotal: anKgHa * superficie, coste: anKgHa * superficie * (precios[FERTILIZANTES[0].nombre] ?? FERTILIZANTES[0].precioKg) });

    const sopKgHa = Math.round(planBase.K2O / 0.50);
    rec.push({ f: FERTILIZANTES[4], kgHa: sopKgHa, kgTotal: sopKgHa * superficie, coste: sopKgHa * superficie * (precios[FERTILIZANTES[4].nombre] ?? FERTILIZANTES[4].precioKg) });

    if (planBase.MgO > 0) {
      const mgKgHa = Math.round(planBase.MgO / 0.16);
      rec.push({ f: FERTILIZANTES[6], kgHa: mgKgHa, kgTotal: mgKgHa * superficie, coste: mgKgHa * superficie * (precios[FERTILIZANTES[6].nombre] ?? FERTILIZANTES[6].precioKg) });
    }

    // Quelato Fe si pH alto
    if (ph > 7.0) {
      rec.push({ f: FERTILIZANTES[8], kgHa: 8, kgTotal: 8 * superficie, coste: 8 * superficie * (precios[FERTILIZANTES[8].nombre] ?? FERTILIZANTES[8].precioKg) });
    }

    return rec;
  }, [planBase, superficie, ph, precios]);

  const costeTotal = planFertilizantes.reduce((s, r) => s + r.coste, 0);

  const ic = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
              <FlaskConical className="w-4 h-4 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Fertirrigación y nutrición</h1>
          </div>
          <p className="text-sm text-gray-500">Plan nutricional por variedad · Diagnóstico foliar · Optimización de costes · Penn State 2022 / WSU 2022</p>
        </div>

        {/* Selectores principales */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-5 grid grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Finca</label>
            <select value={farmId} onChange={e => handleFarmChange(parseInt(e.target.value) || "")} className={ic}>
              <option value="">Sin finca específica</option>
              {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            {activeCrops.length > 1 ? (
              <>
                <label className="text-xs text-gray-500 block mb-1">Cultivo</label>
                <select value={selectedCropId} onChange={e => handleCropChange(parseInt(e.target.value) || "")} className={ic}>
                  <option value="">Selecciona cultivo...</option>
                  {activeCrops.map(c => (
                    <option key={c.id} value={c.id}>{c.variety || c.species} {c.surface ? `· ${c.surface} ha` : ""}</option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <label className="text-xs text-gray-500 block mb-1">Especie / Variedad</label>
                <select value={variedadId} onChange={e => selectVariedad(e.target.value)} className={ic}>
                  <option value="">Selecciona variedad...</option>
                  {CATALOGO.map(esp => (
                    <optgroup key={esp.nombre} label={esp.nombre}>
                      {esp.variedades.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                    </optgroup>
                  ))}
                </select>
              </>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Producción esperada (kg/ha)</label>
            <input type="number" value={produccionKgHa} onChange={e => setProduccion(parseInt(e.target.value))} className={ic} step="500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Superficie (ha)</label>
            <input type="number" value={superficie} onChange={e => setSuperficie(parseFloat(e.target.value))} className={ic} step="0.5" min="0.1" />
          </div>
        </div>

        {!variedad ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <FlaskConical className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">Selecciona una variedad para generar el plan de fertirrigación</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-5">
            {/* ── Columna izquierda: suelo + foliar ── */}
            <div className="space-y-4">
              {/* Suelo */}
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Parámetros del suelo</h3>
                <div className="space-y-3">
                  {[
                    { label: "pH suelo", val: ph, set: setPh, min: 4.5, max: 9.0, step: 0.1, warn: ph < 5.8 || ph > 7.2 },
                    { label: "CE agua riego (dS/m)", val: ce, set: setCe, min: 0.1, max: 5.0, step: 0.1, warn: ce > 1.0 },
                    { label: "Materia orgánica (%)", val: mo, set: setMo, min: 0.1, max: 8.0, step: 0.1, warn: mo < 1.5 },
                  ].map(p => (
                    <div key={p.label}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-gray-600">{p.label}</label>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${p.warn ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>{p.val.toFixed(1)}</span>
                      </div>
                      <input type="range" min={p.min} max={p.max} step={p.step} value={p.val} onChange={e => p.set(parseFloat(e.target.value))} className="w-full" />
                    </div>
                  ))}
                </div>
                {alertas.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {alertas.map((a, i) => (
                      <div key={i} className="flex gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800">{a}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Análisis foliar */}
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Análisis foliar</h3>
                  <button onClick={() => setEditFoliar(e => !e)}
                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
                    <Pencil className="w-3 h-3" /> {editFoliar ? "Colapsar" : "Editar"}
                  </button>
                </div>
                {editFoliar && (
                  <div className="space-y-2">
                    {ELEMENTOS.map(elem => {
                      const rango = activeRangos ? (activeRangos as any)[elem] as [number, number] : null;
                      const estado = rango ? getEstado(foliar[elem], rango) : null;
                      return (
                        <div key={elem} className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-gray-700 w-7">{elem}</span>
                          <input type="number" value={foliar[elem] || ""}
                            onChange={e => setFoliar(prev => ({ ...prev, [elem]: parseFloat(e.target.value) || 0 }))}
                            placeholder={rango ? `${rango[0]}-${rango[1]}` : ""}
                            className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                            step={UNIDADES[elem] === "%" ? "0.01" : "1"} />
                          <span className="text-xs text-gray-400 w-8">{UNIDADES[elem]}</span>
                          {estado && estado !== "optimo" && (
                            <div className={`w-2 h-2 rounded-full ${estado === "deficiente" ? "bg-red-500" : "bg-amber-400"}`} />
                          )}
                          {estado === "optimo" && foliar[elem] > 0 && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Rangos editables */}
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-900">Rangos óptimos</h3>
                  {rangos && (
                    <button onClick={() => setRangos(null)}
                      className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> Restaurar
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-2">Edita los rangos específicos de tu variedad. Se guardan en la sesión.</p>
                <div className="space-y-1.5">
                  {ELEMENTOS.slice(0, 5).map(elem => {
                    const r = activeRangos ? (activeRangos as any)[elem] as [number, number] : [0, 0];
                    return (
                      <div key={elem} className="flex items-center gap-1.5">
                        <span className="text-xs font-mono w-6 text-gray-600">{elem}</span>
                        <input type="number" value={r[0]} step={UNIDADES[elem] === "%" ? "0.05" : "5"}
                          onChange={e => {
                            const cur = activeRangos ? { ...activeRangos } : variedad.rangoFoliar;
                            const updated = { ...cur, [elem]: [parseFloat(e.target.value), (cur as any)[elem][1]] };
                            setRangos(updated as RangoFoliar);
                          }}
                          className="w-16 border border-gray-200 rounded px-1 py-0.5 text-xs text-center" />
                        <span className="text-xs text-gray-400">—</span>
                        <input type="number" value={r[1]} step={UNIDADES[elem] === "%" ? "0.05" : "5"}
                          onChange={e => {
                            const cur = activeRangos ? { ...activeRangos } : variedad.rangoFoliar;
                            const updated = { ...cur, [elem]: [(cur as any)[elem][0], parseFloat(e.target.value)] };
                            setRangos(updated as RangoFoliar);
                          }}
                          className="w-16 border border-gray-200 rounded px-1 py-0.5 text-xs text-center" />
                        <span className="text-xs text-gray-400">{UNIDADES[elem]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Columna central + derecha: plan ── */}
            <div className="col-span-2 space-y-4">
              {/* Plan NPK base */}
              {planBase && (
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">
                    Plan NPK anual — {variedad.nombre} · {produccionKgHa.toLocaleString()} kg/ha
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">
                    Basado en extracción por tonelada producida · Corrección pH, CE y MO del suelo aplicada
                  </p>
                  <div className="grid grid-cols-5 gap-2 mb-4">
                    {[
                      { label: "N", val: planBase.N, unit: "kg/ha", color: "green" },
                      { label: "P₂O₅", val: planBase.P2O5, unit: "kg/ha", color: "amber" },
                      { label: "K₂O", val: planBase.K2O, unit: "kg/ha", color: "blue" },
                      { label: "CaO", val: planBase.CaO, unit: "kg/ha", color: "gray" },
                      { label: "MgO", val: planBase.MgO, unit: "kg/ha", color: "gray" },
                    ].map(k => (
                      <div key={k.label} className="bg-gray-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500 mb-1">{k.label}</p>
                        <p className="text-xl font-bold text-gray-900">{k.val}</p>
                        <p className="text-xs text-gray-400">{k.unit}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800">
                    <strong>Para {superficie} ha:</strong> N: {planBase.N * superficie} kg · P₂O₅: {planBase.P2O5 * superficie} kg · K₂O: {planBase.K2O * superficie} kg
                  </div>
                </div>
              )}

              {/* Diagnóstico foliar con gráfico */}
              {foliar.N > 0 && activeRangos && (
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Diagnóstico foliar</h3>
                  <p className="text-xs text-gray-500 mb-3">Comparativa valor analizado vs rango óptimo de variedad</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      {diagnostico.filter(d => d.val > 0).map(d => (
                        <div key={d.elem} className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold w-7">{d.elem}</span>
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${
                              d.estado === "optimo" ? "bg-green-500" :
                              d.estado === "deficiente" ? "bg-red-500" :
                              d.estado === "exceso" ? "bg-orange-500" : "bg-amber-400"
                            }`} style={{ width: `${Math.min(100, Math.max(5, (d.val / d.rango[1]) * 100))}%` }} />
                          </div>
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${ESTADO_COLOR[d.estado]}`}>
                            {d.val} {UNIDADES[d.elem]}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="space-y-2">
                        {diagnostico.filter(d => d.val > 0 && d.estado !== "optimo").map(d => (
                          <div key={d.elem} className={`rounded-lg p-2 border text-xs ${ESTADO_COLOR[d.estado]}`}>
                            <strong>{d.elem}:</strong> {d.estado === "deficiente" ? "Deficiencia" : d.estado === "leve" ? "Subóptimo" : "Exceso"} — {d.val} {UNIDADES[d.elem]} (óptimo {d.rango[0]}-{d.rango[1]})
                          </div>
                        ))}
                        {diagnostico.filter(d => d.val > 0 && d.estado !== "optimo").length === 0 && (
                          <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg p-3 text-sm">
                            <CheckCircle2 className="w-4 h-4" /> Todos los elementos en rango óptimo
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Plan por fenofases */}
              {planFenofases.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Distribución por fenofases</h3>
                  <p className="text-xs text-gray-500 mb-4">kg de nutriente por hectárea en cada fase del cultivo</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left text-xs text-gray-500 uppercase px-3 py-2">Fenofase</th>
                          <th className="text-right text-xs text-gray-500 uppercase px-3 py-2">N (kg/ha)</th>
                          <th className="text-right text-xs text-gray-500 uppercase px-3 py-2">P₂O₅</th>
                          <th className="text-right text-xs text-gray-500 uppercase px-3 py-2">K₂O</th>
                          <th className="text-left text-xs text-gray-500 uppercase px-3 py-2 max-w-xs">Criterio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {planFenofases.map((f, i) => (
                          <tr key={i} className="border-b border-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-900">{f.fase}</td>
                            <td className="px-3 py-2 text-right text-green-700 font-semibold">{f.N_kg}</td>
                            <td className="px-3 py-2 text-right text-amber-700 font-semibold">{f.P_kg}</td>
                            <td className="px-3 py-2 text-right text-blue-700 font-semibold">{f.K_kg}</td>
                            <td className="px-3 py-2 text-xs text-gray-500 max-w-xs">{f.descripcion}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Panel de precios editables */}
              {planFertilizantes.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <button onClick={() => setShowPrecios(p => !p)}
                    className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-semibold text-gray-900">Precios de fertilizantes</span>
                      <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Edita con tus precios reales</span>
                    </div>
                    {showPrecios ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>

                  {showPrecios && (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {FERTILIZANTES.map(f => (
                        <div key={f.nombre} className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 flex-1 truncate" title={f.nombre}>{f.nombre}</span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <input
                              type="number"
                              value={precios[f.nombre] ?? f.precioKg}
                              onChange={e => setPrecios(prev => ({ ...prev, [f.nombre]: parseFloat(e.target.value) || 0 }))}
                              step="0.01" min="0"
                              className="w-20 border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-green-500"
                            />
                            <span className="text-xs text-gray-400">€/kg</span>
                          </div>
                        </div>
                      ))}
                      <div className="col-span-2 flex justify-end mt-1">
                        <button onClick={() => setPrecios(initPrecios())}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                          <RotateCcw className="w-3 h-3" /> Restaurar precios de referencia
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Optimización fertilizantes */}
              {planFertilizantes.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-blue-600" />
                    Plan de fertilizantes optimizado · {superficie} ha
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">Selección de fertilizantes para cubrir el plan NPK al menor coste</p>
                  <table className="w-full text-sm mb-3">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left text-xs text-gray-500 uppercase px-3 py-2">Fertilizante</th>
                        <th className="text-right text-xs text-gray-500 uppercase px-3 py-2">kg/ha</th>
                        <th className="text-right text-xs text-gray-500 uppercase px-3 py-2">Total ({superficie}ha)</th>
                        <th className="text-right text-xs text-gray-500 uppercase px-3 py-2">€/kg</th>
                        <th className="text-right text-xs text-gray-500 uppercase px-3 py-2">Coste €</th>
                      </tr>
                    </thead>
                    <tbody>
                      {planFertilizantes.map((r, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-900">{r.f.nombre}</td>
                          <td className="px-3 py-2 text-right">{r.kgHa}</td>
                          <td className="px-3 py-2 text-right">{r.kgTotal.toLocaleString()} kg</td>
                          <td className="px-3 py-2 text-right text-gray-500">{(precios[r.f.nombre] ?? r.f.precioKg).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-green-700">{r.coste.toFixed(0)}€</td>
                        </tr>
                      ))}
                      <tr className="bg-green-50 font-bold">
                        <td className="px-3 py-2" colSpan={4}>Coste total {superficie} ha</td>
                        <td className="px-3 py-2 text-right text-green-800 text-base">{costeTotal.toFixed(0)}€</td>
                      </tr>
                      <tr className="bg-gray-50">
                        <td className="px-3 py-2 text-gray-500" colSpan={4}>Coste por hectárea</td>
                        <td className="px-3 py-2 text-right text-gray-700 font-semibold">{(costeTotal / superficie).toFixed(0)} €/ha</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="text-xs text-gray-400">
                    ⚠ Estimación orientativa. Precios de referencia sin IVA — ajusta a precios reales de tu proveedor. Las dosis deben validarse con técnico agronómico.
                    <br />Ref: Penn State Tree Fruit Guide 2022-23 · WSU EM119E (2022) · Stiles & Reid 1991
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

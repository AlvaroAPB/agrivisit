import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Plus, Pencil, Trash2, X, MapPin, Sprout, Navigation } from "lucide-react";
import { CATALOGO } from "../lib/catalogo";
import MapaSatelite from "./MapaSatelite";
import type { Parcel } from "../../../drizzle/schema";

const ic = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

interface ParcelFormState {
  name: string;
  surface: string;
  especie: string;
  variedad: string;
  anyoPlantacion: string;
  anyoProduccion: string;
  distLineas: string;
  distPlantas: string;
  densidad: string;
  conduccion: string;
  portainjerto: string;
  nPlantas: string;
  tipoSuelo: string;
  ph: string;
  materiaOrganica: string;
  ce: string;
  notes: string;
  // Geolocalización
  centerLat: string;
  centerLng: string;
  altitud: string;
  polygon: string; // JSON serializado
}

const emptyForm: ParcelFormState = {
  name: "", surface: "", especie: "", variedad: "",
  anyoPlantacion: "", anyoProduccion: "",
  distLineas: "", distPlantas: "", densidad: "",
  conduccion: "", portainjerto: "", nPlantas: "",
  tipoSuelo: "", ph: "", materiaOrganica: "", ce: "",
  notes: "",
  centerLat: "", centerLng: "", altitud: "", polygon: "",
};

function parcelToForm(p: Parcel): ParcelFormState {
  return {
    name: p.name,
    surface: p.surface ?? "",
    especie: p.especie ?? "",
    variedad: p.variedad ?? "",
    anyoPlantacion: p.anyoPlantacion?.toString() ?? "",
    anyoProduccion: p.anyoProduccion?.toString() ?? "",
    distLineas: p.distLineas ?? "",
    distPlantas: p.distPlantas ?? "",
    densidad: p.densidad?.toString() ?? "",
    conduccion: p.conduccion ?? "",
    portainjerto: p.portainjerto ?? "",
    nPlantas: p.nPlantas?.toString() ?? "",
    tipoSuelo: p.tipoSuelo ?? "",
    ph: p.ph ?? "",
    materiaOrganica: p.materiaOrganica ?? "",
    ce: p.ce ?? "",
    notes: p.notes ?? "",
    centerLat: p.centerLat ?? "",
    centerLng: p.centerLng ?? "",
    altitud: "",
    polygon: p.polygon ?? "",
  };
}

function ParcelModal({
  farmId, parcel, onClose, onSaved,
}: {
  farmId: number;
  parcel?: Parcel | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<ParcelFormState>(parcel ? parcelToForm(parcel) : emptyForm);
  const [showMap, setShowMap] = useState(false);
  const [coordInput, setCoordInput] = useState(
    parcel?.centerLat && parcel?.centerLng ? `${parcel.centerLat}, ${parcel.centerLng}` : ""
  );
  const [coordError, setCoordError] = useState("");

  const set = (k: keyof ParcelFormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setF(p => ({ ...p, [k]: e.target.value }));

  // ── Conversor de coordenadas ──────────────────────────────────────────────
  function parseCoords(raw: string): { lat: number; lng: number } | null {
    const s = raw.trim();
    // Formato decimal: "36.7234, -4.4215" o "36.7234 -4.4215"
    const decimal = s.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
    if (decimal) return { lat: parseFloat(decimal[1]), lng: parseFloat(decimal[2]) };
    // Formato GMS: 36°43'24"N 4°25'17"W o similar
    const gms = s.match(/(\d+)[°º](\d+)['′](\d+(?:\.\d+)?)["″]?\s*([NS])[,\s]+(\d+)[°º](\d+)['′](\d+(?:\.\d+)?)["″]?\s*([EWOo])/i);
    if (gms) {
      const lat = (parseInt(gms[1]) + parseInt(gms[2])/60 + parseFloat(gms[3])/3600) * (gms[4].toUpperCase() === "S" ? -1 : 1);
      const lng = (parseInt(gms[5]) + parseInt(gms[6])/60 + parseFloat(gms[7])/3600) * ("WwOo".includes(gms[8]) ? -1 : 1);
      return { lat, lng };
    }
    return null;
  }

  function applyCoords(lat: number, lng: number, altitud?: string) {
    setF(p => ({ ...p, centerLat: String(lat), centerLng: String(lng), altitud: altitud ?? p.altitud }));
    setCoordInput(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    setCoordError("");
  }

  function handleCoordInput(raw: string) {
    setCoordInput(raw);
    const parsed = parseCoords(raw);
    if (parsed) {
      setCoordError("");
      setF(p => ({ ...p, centerLat: String(parsed.lat), centerLng: String(parsed.lng) }));
    } else if (raw.length > 5) {
      setCoordError('Formato no reconocido. Usa: 36.7234, -4.4215 o 36°43\'24"N 4°25\'17"W');
    }
  }

  // Mostrar formatos equivalentes
  function toDMS(dd: number, isLat: boolean): string {
    const abs = Math.abs(dd);
    const d = Math.floor(abs);
    const m = Math.floor((abs - d) * 60);
    const s = ((abs - d - m/60) * 3600).toFixed(1);
    const dir = isLat ? (dd >= 0 ? "N" : "S") : (dd >= 0 ? "E" : "W");
    return `${d}°${m}'${s}"${dir}`;
  }

  const parsedCoords = f.centerLat && f.centerLng ? { lat: parseFloat(f.centerLat), lng: parseFloat(f.centerLng) } : null;

  const create = trpc.parcels.create.useMutation({ onSuccess: () => { onSaved(); onClose(); } });
  const update = trpc.parcels.update.useMutation({ onSuccess: () => { onSaved(); onClose(); } });

  // Auto-calcular densidad y nº plantas al cambiar distancias o superficie
  const recalc = (next: ParcelFormState): ParcelFormState => {
    const dl = parseFloat(next.distLineas);
    const dp = parseFloat(next.distPlantas);
    const sup = parseFloat(next.surface);
    if (dl > 0 && dp > 0) {
      const dens = Math.round(10000 / (dl * dp));
      next.densidad = String(dens);
      if (sup > 0) next.nPlantas = String(Math.round(dens * sup));
    } else if (next.densidad && sup > 0) {
      next.nPlantas = String(Math.round(parseFloat(next.densidad) * sup));
    }
    return next;
  };

  const onDistChange = (k: "distLineas" | "distPlantas") =>
    (e: React.ChangeEvent<HTMLInputElement>) => setF(p => recalc({ ...p, [k]: e.target.value }));

  const onSurfaceChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setF(p => recalc({ ...p, surface: e.target.value }));

  const onDensidadChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setF(p => recalc({ ...p, densidad: e.target.value }));

  const handleSave = () => {
    const payload = {
      farmId,
      name: f.name.trim(),
      surface: f.surface || undefined,
      especie: f.especie || undefined,
      variedad: f.variedad || undefined,
      anyoPlantacion: f.anyoPlantacion ? parseInt(f.anyoPlantacion) : undefined,
      anyoProduccion: f.anyoProduccion ? parseInt(f.anyoProduccion) : undefined,
      distLineas: f.distLineas || undefined,
      distPlantas: f.distPlantas || undefined,
      densidad: f.densidad ? parseInt(f.densidad) : undefined,
      conduccion: f.conduccion || undefined,
      portainjerto: f.portainjerto || undefined,
      nPlantas: f.nPlantas ? parseInt(f.nPlantas) : undefined,
      tipoSuelo: f.tipoSuelo || undefined,
      ph: f.ph || undefined,
      materiaOrganica: f.materiaOrganica || undefined,
      ce: f.ce || undefined,
      notes: f.notes || undefined,
    };
    if (!payload.name) return;
    const withCoords = {
      ...payload,
      centerLat: f.centerLat ? parseFloat(f.centerLat) : undefined,
      centerLng: f.centerLng ? parseFloat(f.centerLng) : undefined,
      polygon: f.polygon || undefined,
    };
    if (parcel) update.mutate({ id: parcel.id, ...withCoords });
    else create.mutate(withCoords);
  };

  // Variedades del catálogo filtradas por especie elegida
  const especieMatch = CATALOGO.find(e => e.nombre === f.especie);
  const variedadesDisponibles = especieMatch?.variedades ?? [];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-lg text-gray-900">
            {parcel ? `Editar ${parcel.name}` : "Nueva parcela"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {/* Identificación */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Identificación</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Nombre *</label>
                <input value={f.name} onChange={set("name")} className={ic} placeholder="Parcela A" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Superficie (ha)</label>
                <input type="number" step="0.01" value={f.surface} onChange={onSurfaceChange} className={ic} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Año plantación</label>
                <input type="number" value={f.anyoPlantacion} onChange={set("anyoPlantacion")} className={ic} placeholder="2022" />
              </div>
            </div>
          </div>

          {/* Cultivo */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Cultivo</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Especie</label>
                <select value={f.especie} onChange={e => setF(p => ({ ...p, especie: e.target.value, variedad: "" }))} className={ic}>
                  <option value="">—</option>
                  {CATALOGO.map(e => <option key={e.nombre} value={e.nombre}>{e.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Variedad</label>
                <select value={f.variedad} onChange={set("variedad")} className={ic} disabled={!f.especie}>
                  <option value="">—</option>
                  {variedadesDisponibles.map(v => <option key={v.id} value={v.nombre}>{v.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Año primera producción</label>
                <input type="number" value={f.anyoProduccion} onChange={set("anyoProduccion")} className={ic} placeholder="2024" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Portainjerto</label>
                <input value={f.portainjerto} onChange={set("portainjerto")} className={ic} />
              </div>
            </div>
          </div>

          {/* Marco y conducción */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Marco y conducción</h3>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Dist. líneas (m)</label>
                <input type="number" step="0.01" value={f.distLineas} onChange={onDistChange("distLineas")} className={ic} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Dist. plantas (m)</label>
                <input type="number" step="0.01" value={f.distPlantas} onChange={onDistChange("distPlantas")} className={ic} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Densidad (pl/ha)</label>
                <input type="number" value={f.densidad} onChange={onDensidadChange} className={ic} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Nº plantas total</label>
                <input type="number" value={f.nPlantas} onChange={set("nPlantas")} className={ic} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 block mb-1">Sistema de conducción</label>
                <input value={f.conduccion} onChange={set("conduccion")} className={ic} placeholder="Hilera en malla, Espaldera..." />
              </div>
            </div>
          </div>

          {/* Suelo */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Suelo</h3>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tipo de suelo</label>
                <input value={f.tipoSuelo} onChange={set("tipoSuelo")} className={ic} placeholder="Franco-arenoso..." />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">pH</label>
                <input type="number" step="0.1" value={f.ph} onChange={set("ph")} className={ic} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">M.O. (%)</label>
                <input type="number" step="0.1" value={f.materiaOrganica} onChange={set("materiaOrganica")} className={ic} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">CE (dS/m)</label>
                <input type="number" step="0.01" value={f.ce} onChange={set("ce")} className={ic} />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Notas</label>
            <textarea value={f.notes} onChange={set("notes")} className={ic} rows={2} />
          </div>
        </div>

        {/* Geolocalización */}
        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-green-600" /> Geolocalización
          </h3>

          {/* Input coordenadas con conversor */}
          <div className="mb-3">
            <label className="text-xs text-gray-500 block mb-1">
              Coordenadas del centro (decimal, GMS o UTM)
            </label>
            <div className="flex gap-2">
              <input
                value={coordInput}
                onChange={e => handleCoordInput(e.target.value)}
                className={`flex-1 ${ic} ${coordError ? "border-red-300 focus:ring-red-400" : ""}`}
                placeholder="36.7234, -4.4215  ó  36°43'24N 4°25'17W"
              />
              <button
                type="button"
                onClick={() => setShowMap(m => !m)}
                className={`px-3 py-2 rounded-lg text-sm border transition-colors ${showMap ? "bg-green-600 text-white border-green-600" : "border-gray-200 text-gray-600 hover:border-green-400"}`}
              >
                🗺️ {showMap ? "Cerrar mapa" : "Ver mapa"}
              </button>
            </div>
            {coordError && <p className="text-xs text-red-500 mt-1">{coordError}</p>}

            {/* Formatos equivalentes */}
            {parsedCoords && (
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                <span><span className="text-gray-400">Decimal:</span> {parsedCoords.lat.toFixed(6)}, {parsedCoords.lng.toFixed(6)}</span>
                <span><span className="text-gray-400">GMS:</span> {toDMS(parsedCoords.lat, true)} {toDMS(parsedCoords.lng, false)}</span>
                {f.altitud && <span><span className="text-gray-400">Altitud:</span> <strong>{f.altitud} m</strong></span>}
                <a href={`https://maps.google.com/?q=${parsedCoords.lat},${parsedCoords.lng}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline ml-auto">Google Maps →</a>
              </div>
            )}
          </div>

          {/* Mapa */}
          {showMap && (
            <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: 350 }}>
              <MapaSatelite
                lat={parsedCoords?.lat ?? 36.7}
                lng={parsedCoords?.lng ?? -4.4}
                initialPolygon={f.polygon ? JSON.parse(f.polygon) : undefined}
                onSelect={(la, lo) => applyCoords(la, lo)}
                onLocationFound={(info) => {
                  if (info.altitud) setF(p => ({ ...p, altitud: info.altitud! }));
                }}
                onPolygonChange={(info) => {
                  setF(p => ({
                    ...p,
                    polygon: info.polygon ? JSON.stringify(info.polygon) : "",
                    surface: info.areaHa ? info.areaHa.toFixed(2) : p.surface,
                  }));
                }}
                pais="España"
              />
            </div>
          )}
          {showMap && (
            <p className="text-xs text-gray-400 mt-2">
              💡 Clic en el mapa para marcar el centro · Usa el modo polígono para delimitar la parcela (calcula la superficie automáticamente)
            </p>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={!f.name.trim() || create.isPending || update.isPending}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {parcel ? "Guardar cambios" : "Crear parcela"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ParcelasSection({ farmId }: { farmId: number }) {
  const { data: parcels = [], refetch } = trpc.parcels.listByFarm.useQuery({ farmId });
  const deleteParcel = trpc.parcels.delete.useMutation({ onSuccess: () => refetch() });
  const migrate = trpc.parcels.migrateFromFarmJSON.useMutation({ onSuccess: () => refetch() });

  const [editing, setEditing] = useState<Parcel | null>(null);
  const [showNew, setShowNew] = useState(false);

  const totalSurface = parcels.reduce((s, p) => s + parseFloat(p.surface || "0"), 0);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Parcelas ({parcels.length})</h2>
          {totalSurface > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">Total: {totalSurface.toFixed(2)} ha</p>
          )}
        </div>
        <div className="flex gap-2">
          {parcels.length === 0 && (
            <button
              onClick={() => migrate.mutate()}
              disabled={migrate.isPending}
              className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50"
              title="Crea parcelas a partir de los datos guardados en la ficha de la finca"
            >
              {migrate.isPending ? "Importando..." : "Importar desde ficha"}
            </button>
          )}
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus className="w-3.5 h-3.5" /> Nueva parcela
          </button>
        </div>
      </div>

      <div className="p-4">
        {parcels.length === 0 ? (
          <div className="text-center py-6">
            <Sprout className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Esta finca aún no tiene parcelas</p>
            <p className="text-xs text-gray-400 mt-1">
              Si la finca ya tiene variedad y superficie en su ficha, usa <strong>Importar desde ficha</strong>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {parcels.map(p => (
              <div key={p.id} className="border border-gray-100 rounded-lg p-3 hover:border-green-200 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{p.name}</p>
                    <p className="text-xs text-gray-500">
                      {p.especie}{p.variedad && ` · ${p.variedad}`}
                    </p>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={() => setEditing(p)}
                      className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { if (confirm(`¿Eliminar ${p.name}?`)) deleteParcel.mutate({ id: p.id }); }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {p.surface && (
                    <div><span className="text-gray-400">Sup.</span> <span className="text-gray-700 font-medium">{p.surface} ha</span></div>
                  )}
                  {p.anyoPlantacion && (
                    <div><span className="text-gray-400">Plant.</span> <span className="text-gray-700 font-medium">{p.anyoPlantacion}</span></div>
                  )}
                  {p.densidad && (
                    <div><span className="text-gray-400">Dens.</span> <span className="text-gray-700 font-medium">{p.densidad} pl/ha</span></div>
                  )}
                  {p.distLineas && p.distPlantas && (
                    <div><span className="text-gray-400">Marco</span> <span className="text-gray-700 font-medium">{p.distLineas}×{p.distPlantas}</span></div>
                  )}
                  {p.ph && (
                    <div><span className="text-gray-400">pH</span> <span className="text-gray-700 font-medium">{p.ph}</span></div>
                  )}
                  {p.tipoSuelo && (
                    <div className="col-span-3 truncate"><span className="text-gray-400">Suelo:</span> <span className="text-gray-700">{p.tipoSuelo}</span></div>
                  )}
                  {p.centerLat && p.centerLng && (
                    <div className="col-span-3">
                      <a href={`https://maps.google.com/?q=${p.centerLat},${p.centerLng}`} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 hover:underline flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {parseFloat(p.centerLat).toFixed(4)}, {parseFloat(p.centerLng).toFixed(4)}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNew && <ParcelModal farmId={farmId} onClose={() => setShowNew(false)} onSaved={() => refetch()} />}
      {editing && <ParcelModal farmId={farmId} parcel={editing} onClose={() => setEditing(null)} onSaved={() => refetch()} />}
    </div>
  );
}

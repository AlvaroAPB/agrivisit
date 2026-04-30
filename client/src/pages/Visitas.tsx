import { useState } from "react";
import { Link, useRoute, useLocation } from "wouter";
import Sidebar from "../components/Sidebar";
import { trpc } from "../lib/trpc";
import {
  Plus, ChevronLeft, Trash2, CheckCircle2, Clock, Pencil, X, Save,
  FileText, Download, Leaf, Droplets, Bug, Ruler, ClipboardList, Star, Camera, ImageIcon
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// ─── Constantes ───────────────────────────────────────────────────────────────
const FENOFASES = [
  "Yema hinchada", "Punta verde", "Apertura floral", "Plena flor",
  "Caída pétalos", "Cuajado", "Fruto 5mm", "Fruto 10mm",
  "Fruto 20mm", "Envero", "Maduración", "Recolección", "Postcosecha",
];

const PRESION_COLOR: Record<string, string> = {
  baja: "bg-green-100 text-green-700",
  media: "bg-amber-100 text-amber-700",
  alta: "bg-orange-100 text-orange-700",
  "crítica": "bg-red-100 text-red-700",
};

const ic = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white";


// ─── Galería de fotos por entrada ────────────────────────────────────────────
function PhotosSection({ entryId }: { entryId: number }) {
  const { data: photos = [], refetch } = trpc.visitPhotos.listByEntry.useQuery({ entryId });
  const signUpload = trpc.visitPhotos.signUpload.useMutation();
  const savePhoto = trpc.visitPhotos.save.useMutation({ onSuccess: () => refetch() });
  const deletePhoto = trpc.visitPhotos.delete.useMutation({ onSuccess: () => refetch() });
  const updateCaption = trpc.visitPhotos.updateCaption.useMutation({ onSuccess: () => refetch() });
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState<number | null>(null);
  const [captionDraft, setCaptionDraft] = useState("");

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [captionModal, setCaptionModal] = useState<{file: File, preview: string} | null>(null);
  const [captionText, setCaptionText] = useState("");

  const uploadFile = async (file: File, caption: string) => {
    const { signature, timestamp, folder, apiKey, cloudName } = await signUpload.mutateAsync({ entryId });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", apiKey);
    formData.append("timestamp", String(timestamp));
    formData.append("signature", signature);
    formData.append("folder", folder);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST", body: formData,
    });
    const data = await res.json();
    if (data.secure_url) {
      await savePhoto.mutateAsync({ entryId, publicId: data.public_id, url: data.secure_url, caption: caption || undefined });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = "";
    // Si es una sola foto, pedir caption; si son varias, subir directamente
    if (files.length === 1) {
      const preview = URL.createObjectURL(files[0]);
      setCaptionModal({ file: files[0], preview });
      setCaptionText("");
    } else {
      setUploading(true);
      try {
        for (const file of files) await uploadFile(file, "");
      } finally { setUploading(false); }
    }
  };

  const handleCaptionSubmit = async () => {
    if (!captionModal) return;
    setUploading(true);
    setCaptionModal(null);
    try {
      await uploadFile(captionModal.file, captionText);
    } finally { setUploading(false); setCaptionText(""); }
  };

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
          <Camera className="w-3.5 h-3.5" /> Fotos ({photos.length})
        </p>
        <label className={`cursor-pointer flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors ${uploading ? "bg-gray-100 text-gray-400" : "bg-green-50 text-green-700 hover:bg-green-100"}`}>
          {uploading ? "Subiendo..." : <><Plus className="w-3 h-3" /> Añadir fotos</>}
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} disabled={uploading} />
        </label>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {(photos as any[]).map((p: any) => (
            <div key={p.id} className="relative group">
              <div className="aspect-square">
                <img
                  src={p.url.replace("/upload/", "/upload/w_300,h_300,c_fill/")}
                  alt={p.caption || "Foto visita"}
                  className="w-full h-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setLightbox(p.url)}
                />
                <button
                  onClick={() => { if (confirm("¿Eliminar foto?")) deletePhoto.mutate({ id: p.id, publicId: p.publicId }); }}
                  className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
              {/* Caption editable inline */}
              {editingCaption === p.id ? (
                <div className="mt-1 flex gap-1">
                  <input
                    autoFocus
                    value={captionDraft}
                    onChange={e => setCaptionDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") { updateCaption.mutate({ id: p.id, caption: captionDraft }); setEditingCaption(null); }
                      if (e.key === "Escape") setEditingCaption(null);
                    }}
                    className="flex-1 text-xs px-1.5 py-1 border border-green-400 rounded focus:outline-none"
                    placeholder="Descripción..."
                  />
                  <button onClick={() => { updateCaption.mutate({ id: p.id, caption: captionDraft }); setEditingCaption(null); }} className="text-xs px-1.5 py-1 bg-green-600 text-white rounded">✓</button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditingCaption(p.id); setCaptionDraft(p.caption || ""); }}
                  className="w-full text-left mt-1 text-xs text-gray-400 hover:text-green-600 truncate italic"
                  title="Clic para añadir descripción"
                >
                  {p.caption || "Añadir descripción..."}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal caption para foto individual */}
      {captionModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Añadir descripción</h3>
            <img src={captionModal.preview} className="w-full h-40 object-cover rounded-lg mb-3" />
            <input
              value={captionText}
              onChange={e => setCaptionText(e.target.value)}
              placeholder="Ej: Zona norte con exceso de hierba..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-green-500"
              onKeyDown={e => e.key === "Enter" && handleCaptionSubmit()}
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => { setCaptionModal(null); setCaptionText(""); }} className="flex-1 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200">
                Sin descripción
              </button>
              <button onClick={handleCaptionSubmit} className="flex-1 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                Subir foto
              </button>
            </div>
          </div>
        </div>
      )}

      {photos.length === 0 && !uploading && (
        <label className="cursor-pointer block border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:border-green-300 transition-colors">
          <ImageIcon className="w-6 h-6 text-gray-300 mx-auto mb-1" />
          <p className="text-xs text-gray-400">Pulsa para añadir fotos</p>
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
        </label>
      )}

      {lightbox && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100]" onClick={() => setLightbox(null)}>
          <img src={lightbox} className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
          <button className="absolute top-4 right-4 text-white" onClick={() => setLightbox(null)}>
            <X className="w-8 h-8" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Score visual 1-5 ─────────────────────────────────────────────────────────
function ScoreInput({ value, onChange, label }: { value: number | null; onChange: (v: number) => void; label: string }) {
  const colors = ["", "bg-red-400", "bg-orange-400", "bg-amber-400", "bg-lime-400", "bg-green-500"];
  const labels = ["", "Muy bajo", "Bajo", "Normal", "Bueno", "Excelente"];
  return (
    <div>
      <label className="text-xs text-gray-500 block mb-1.5">{label}</label>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            title={labels[n]}
            className={`w-9 h-9 rounded-lg text-sm font-bold transition-all border-2 ${
              value === n
                ? `${colors[n]} text-white border-transparent shadow-md scale-110`
                : "bg-gray-100 text-gray-400 border-transparent hover:border-gray-300"
            }`}
          >
            {n}
          </button>
        ))}
        {value && <span className="self-center text-xs text-gray-500 ml-1">{labels[value]}</span>}
      </div>
    </div>
  );
}

// ─── Modal nueva entrada ──────────────────────────────────────────────────────
function EntryModal({
  reportId, farms, onClose, onSaved, existing,
}: {
  reportId: number;
  farms: any[];
  onClose: () => void;
  onSaved: () => void;
  existing?: any;
}) {
  const [farmId, setFarmId] = useState<number | "">(existing?.entry.farmId ?? "");
  const [parcelId, setParcelId] = useState<number | "">(existing?.entry.parcelId ?? "");
  const [visitDate, setVisitDate] = useState(
    existing ? format(new Date(existing.entry.visitDate), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")
  );

  const { data: parcels = [] } = trpc.parcels.listByFarm.useQuery(
    { farmId: farmId as number },
    { enabled: typeof farmId === "number" && farmId > 0 }
  );

  // Estado cultivo
  const [fenofase, setFenofase] = useState(existing?.entry.estadoFenologico ?? "");
  const [semanas, setSemanas] = useState(existing?.entry.semanasDesdeFlor?.toString() ?? "");
  const [vigor, setVigor] = useState<number | null>(existing?.entry.vigorVegetativo ?? null);
  const [color, setColor] = useState<number | null>(existing?.entry.colorFoliaje ?? null);
  const [sanitario, setSanitario] = useState<number | null>(existing?.entry.estadoSanitario ?? null);
  const [riego, setRiego] = useState<number | null>(existing?.entry.estadoRiego ?? null);

  // Fitosanitario
  const [plagas, setPlagas] = useState(existing?.entry.plagasDetectadas ?? "");
  const [enfermedades, setEnfermedades] = useState(existing?.entry.enfermedadesDetectadas ?? "");
  const [presion, setPresion] = useState(existing?.entry.presionFitosanitaria ?? "");

  // Calidad fruta
  const [brix, setBrix] = useState(existing?.entry.brixGrados ?? "");
  const [calibre, setCalibre] = useState(existing?.entry.calibreMm ?? "");
  const [firmeza, setFirmeza] = useState(existing?.entry.firmezaKg ?? "");
  const [pctColor, setPctColor] = useState(existing?.entry.porcentajeColor?.toString() ?? "");
  const [pesoBaya, setPesoBaya] = useState(existing?.entry.pesoMedioBaya ?? "");

  // Texto
  const [tareas, setTareas] = useState(existing?.entry.tareasRealizadas ?? "");
  const [observaciones, setObservaciones] = useState(existing?.entry.observaciones ?? "");
  const [recomendaciones, setRecomendaciones] = useState(existing?.entry.recomendaciones ?? "");

  const addEntry = trpc.visitReports.addEntry.useMutation({ onSuccess: () => { onSaved(); onClose(); } });
  const updateEntry = trpc.visitReports.updateEntry.useMutation({ onSuccess: () => { onSaved(); onClose(); } });

  const handleSave = () => {
    if (!farmId || !visitDate) return;
    const payload = {
      farmId: farmId as number,
      parcelId: parcelId ? parcelId as number : undefined,
      visitDate: new Date(visitDate),
      estadoFenologico: fenofase || undefined,
      semanasDesdeFlor: semanas ? parseInt(semanas) : undefined,
      vigorVegetativo: vigor ?? undefined,
      colorFoliaje: color ?? undefined,
      estadoSanitario: sanitario ?? undefined,
      estadoRiego: riego ?? undefined,
      plagasDetectadas: plagas || undefined,
      enfermedadesDetectadas: enfermedades || undefined,
      presionFitosanitaria: presion as any || undefined,
      brixGrados: brix || undefined,
      calibreMm: calibre || undefined,
      firmezaKg: firmeza || undefined,
      porcentajeColor: pctColor ? parseInt(pctColor) : undefined,
      pesoMedioBaya: pesoBaya || undefined,
      tareasRealizadas: tareas || undefined,
      observaciones: observaciones || undefined,
      recomendaciones: recomendaciones || undefined,
    };
    if (existing) updateEntry.mutate({ id: existing.entry.id, ...payload });
    else addEntry.mutate({ reportId, ...payload });
  };

  const farmName = farms.find(f => f.id === farmId)?.name;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">
            {existing ? `Editar — ${existing.farm.name}` : "Nueva entrada de visita"}
          </h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-6">
          {/* Finca + fecha */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Finca *</label>
              <select value={farmId} onChange={e => { setFarmId(parseInt(e.target.value) || ""); setParcelId(""); }} className={ic}>
                <option value="">Selecciona finca...</option>
                {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Parcela (opcional)</label>
              <select value={parcelId} onChange={e => setParcelId(parseInt(e.target.value) || "")} className={ic} disabled={!farmId}>
                <option value="">Finca completa</option>
                {parcels.map((p: any) => <option key={p.id} value={p.id}>{p.name}{p.variedad ? ` · ${p.variedad}` : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha visita *</label>
              <input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} className={ic} />
            </div>
          </div>

          {/* Fenología */}
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1.5">
              <Leaf className="w-3.5 h-3.5 text-green-600" /> Fenología
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-gray-500 block mb-1">Estado fenológico</label>
                <select value={fenofase} onChange={e => setFenofase(e.target.value)} className={ic}>
                  <option value="">—</option>
                  {FENOFASES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Semanas desde plena flor</label>
                <input type="number" value={semanas} onChange={e => setSemanas(e.target.value)} className={ic} min="0" max="52" />
              </div>
            </div>
          </div>

          {/* Estado cultivo */}
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-amber-500" /> Estado del cultivo (1 = muy bajo · 5 = excelente)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <ScoreInput label="Vigor vegetativo" value={vigor} onChange={setVigor} />
              <ScoreInput label="Color del foliaje" value={color} onChange={setColor} />
              <ScoreInput label="Estado sanitario" value={sanitario} onChange={setSanitario} />
              <ScoreInput label="Estado del riego" value={riego} onChange={setRiego} />
            </div>
          </div>

          {/* Fitosanitario */}
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1.5">
              <Bug className="w-3.5 h-3.5 text-red-500" /> Fitosanitario
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Plagas detectadas</label>
                <input value={plagas} onChange={e => setPlagas(e.target.value)} className={ic} placeholder="Ej: Araña roja, Trips..." />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Enfermedades detectadas</label>
                <input value={enfermedades} onChange={e => setEnfermedades(e.target.value)} className={ic} placeholder="Ej: Oídio, Monilia..." />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Presión fitosanitaria general</label>
              <div className="flex gap-2">
                {["baja", "media", "alta", "crítica"].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPresion(p === presion ? "" : p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border-2 transition-all capitalize ${
                      presion === p ? `${PRESION_COLOR[p]} border-transparent` : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mediciones */}
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5 text-blue-500" /> Mediciones de calidad de fruta
            </h3>
            <div className="grid grid-cols-5 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Brix (°)</label>
                <input type="number" step="0.1" value={brix} onChange={e => setBrix(e.target.value)} className={ic} placeholder="12.5" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Calibre (mm)</label>
                <input type="number" step="0.5" value={calibre} onChange={e => setCalibre(e.target.value)} className={ic} placeholder="18" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Firmeza (kg)</label>
                <input type="number" step="0.01" value={firmeza} onChange={e => setFirmeza(e.target.value)} className={ic} placeholder="1.2" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">% Color</label>
                <input type="number" min="0" max="100" value={pctColor} onChange={e => setPctColor(e.target.value)} className={ic} placeholder="75" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Peso baya (g)</label>
                <input type="number" step="0.1" value={pesoBaya} onChange={e => setPesoBaya(e.target.value)} className={ic} placeholder="3.5" />
              </div>
            </div>
          </div>

          {/* Tareas + Observaciones */}
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5 text-purple-500" /> Tareas, observaciones y recomendaciones
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tareas realizadas</label>
                <textarea value={tareas} onChange={e => setTareas(e.target.value)} className={ic} rows={2} placeholder="Aplicación de fungicida, poda verde, regulación goteros..." />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Observaciones</label>
                <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} className={ic} rows={2} placeholder="Estado general, incidencias observadas..." />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Recomendaciones</label>
                <textarea value={recomendaciones} onChange={e => setRecomendaciones(e.target.value)} className={ic} rows={2} placeholder="Acciones a tomar, próximas intervenciones..." />
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={!farmId || !visitDate || addEntry.isPending || updateEntry.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {existing ? "Guardar cambios" : "Añadir entrada"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Score badge ─────────────────────────────────────────────────────────────
function ScoreBadge({ value }: { value: number | null }) {
  if (!value) return <span className="text-gray-300">—</span>;
  const colors = ["", "bg-red-100 text-red-700", "bg-orange-100 text-orange-700", "bg-amber-100 text-amber-700", "bg-lime-100 text-lime-700", "bg-green-100 text-green-700"];
  return <span className={`inline-block w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center ${colors[value]}`}>{value}</span>;
}


// ─── Comparativa temporal por parcela ────────────────────────────────────────
function ComparativaEvolucion({ farmId, parcelId, parcelName }: { farmId: number; parcelId?: number; parcelName: string }) {
  const { data: historico = [] } = trpc.visitReports.historicoParcela.useQuery({ farmId, parcelId });
  const [metric, setMetric] = useState<"scores" | "calidad">("scores");

  if (historico.length < 2) return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
      <p className="text-sm text-gray-400">Se necesitan al menos 2 visitas para ver la evolución</p>
    </div>
  );

  const chartData = historico.map((h: any) => ({
    fecha: format(new Date(h.visitDate), "dd/MM", { locale: es }),
    Vigor: h.vigorVegetativo,
    Color: h.colorFoliaje,
    Sanitario: h.estadoSanitario,
    Riego: h.estadoRiego,
    Brix: h.brixGrados ? parseFloat(h.brixGrados) : null,
    Calibre: h.calibreMm ? parseFloat(h.calibreMm) : null,
    Firmeza: h.firmezaKg ? parseFloat(h.firmezaKg) : null,
    fenofase: h.estadoFenologico,
  }));

  const scoreLines = [
    { key: "Vigor", color: "#16a34a" },
    { key: "Color", color: "#0ea5e9" },
    { key: "Sanitario", color: "#f59e0b" },
    { key: "Riego", color: "#8b5cf6" },
  ];

  const calidadLines = [
    { key: "Brix", color: "#f97316" },
    { key: "Calibre", color: "#06b6d4" },
    { key: "Firmeza", color: "#ec4899" },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">Evolución — {parcelName}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{historico.length} visitas registradas</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => setMetric("scores")} className={`px-3 py-1 text-xs rounded-md transition-all ${metric === "scores" ? "bg-white shadow text-gray-900 font-medium" : "text-gray-500"}`}>
            Estado cultivo
          </button>
          <button onClick={() => setMetric("calidad")} className={`px-3 py-1 text-xs rounded-md transition-all ${metric === "calidad" ? "bg-white shadow text-gray-900 font-medium" : "text-gray-500"}`}>
            Calidad fruta
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
          <YAxis domain={metric === "scores" ? [0, 5] : ["auto", "auto"]} tick={{ fontSize: 10 }} />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
            formatter={(value: any, name: string) => [value, name]}
          />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          {metric === "scores"
            ? scoreLines.map(l => <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={2} dot={{ r: 3 }} connectNulls />)
            : calidadLines.map(l => <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={2} dot={{ r: 3 }} connectNulls />)
          }
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Vista detalle del informe ────────────────────────────────────────────────
function ReportDetail({ reportId }: { reportId: number }) {
  const [, navigate] = useLocation();
  const { data: report, refetch: refetchReport } = trpc.visitReports.getById.useQuery({ id: reportId });
  const { data: entries = [], refetch } = trpc.visitReports.getEntries.useQuery({ reportId });
  const { data: farms = [] } = trpc.farms.list.useQuery();
  const updateReport = trpc.visitReports.update.useMutation({ onSuccess: () => refetchReport() });
  const deleteEntry = trpc.visitReports.deleteEntry.useMutation({ onSuccess: () => refetch() });
  const deleteReport = trpc.visitReports.delete.useMutation({ onSuccess: () => navigate("/visitas") });
  const utils = trpc.useUtils();
  const [showEntry, setShowEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfSubtitle, setPdfSubtitle] = useState("");
  const [pdfGenerating, setPdfGenerating] = useState(false);

  if (!report) return <div className="flex-1 p-8 flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full" /></div>;

  const generatePDF = async (subtitle: string = "") => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF();

    // Cabecera SAT Royal
    doc.setFillColor(21, 128, 61);
    const headerH = subtitle ? 38 : 32;
    doc.rect(0, 0, 210, headerH, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18); doc.setFont("helvetica", "bold");
    doc.text("SAT Royal", 14, 14);
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text("Informe Técnico de Visita de Campo", 14, 22);
    if (subtitle) {
      doc.setFontSize(9); doc.setFont("helvetica", "italic");
      doc.text(subtitle, 14, 32);
    }
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Generado: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 196, subtitle ? 32 : 24, { align: "right" });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text(report.title, 14, 44);
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 100);
    doc.text(`Período: ${format(new Date(report.dateStart), "dd MMM yyyy", { locale: es })} — ${format(new Date(report.dateEnd), "dd MMM yyyy", { locale: es })}`, 14, 51);
    doc.text(`Fincas visitadas: ${[...new Set(entries.map((e: any) => e.farm.name))].join(", ")}`, 14, 57);

    let y = subtitle ? 52 : 66;

    // Una sección por entrada
    for (const e of entries as any[]) {
      if (y > 240) { doc.addPage(); y = 20; }

      doc.setFillColor(240, 253, 244);
      doc.rect(14, y, 182, 8, "F");
      doc.setTextColor(21, 128, 61); doc.setFontSize(10); doc.setFont("helvetica", "bold");
      doc.text(`${e.farm.name}${e.parcel ? ` · ${e.parcel.name}` : ""}`, 16, y + 5.5);
      doc.setTextColor(100, 100, 100); doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.text(format(new Date(e.entry.visitDate), "dd/MM/yyyy"), 190, y + 5.5, { align: "right" });
      y += 12;

      const rows: [string, string][] = [];
      if (e.entry.estadoFenologico) rows.push(["Estado fenológico", e.entry.estadoFenologico]);
      if (e.entry.vigorVegetativo) rows.push(["Vigor vegetativo", `${e.entry.vigorVegetativo}/5`]);
      if (e.entry.colorFoliaje) rows.push(["Color foliaje", `${e.entry.colorFoliaje}/5`]);
      if (e.entry.estadoSanitario) rows.push(["Estado sanitario", `${e.entry.estadoSanitario}/5`]);
      if (e.entry.estadoRiego) rows.push(["Estado riego", `${e.entry.estadoRiego}/5`]);
      if (e.entry.presionFitosanitaria) rows.push(["Presión fitosanitaria", e.entry.presionFitosanitaria]);
      if (e.entry.plagasDetectadas) rows.push(["Plagas detectadas", e.entry.plagasDetectadas]);
      if (e.entry.enfermedadesDetectadas) rows.push(["Enfermedades", e.entry.enfermedadesDetectadas]);
      if (e.entry.brixGrados) rows.push(["Brix (°)", e.entry.brixGrados]);
      if (e.entry.calibreMm) rows.push(["Calibre (mm)", e.entry.calibreMm]);
      if (e.entry.firmezaKg) rows.push(["Firmeza (kg)", e.entry.firmezaKg]);
      if (e.entry.porcentajeColor) rows.push(["% Color", `${e.entry.porcentajeColor}%`]);
      if (e.entry.tareasRealizadas) rows.push(["Tareas realizadas", e.entry.tareasRealizadas]);
      if (e.entry.observaciones) rows.push(["Observaciones", e.entry.observaciones]);
      if (e.entry.recomendaciones) rows.push(["Recomendaciones", e.entry.recomendaciones]);

      if (rows.length > 0) {
        autoTable(doc, {
          startY: y,
          body: rows,
          theme: "plain",
          styles: { fontSize: 8, cellPadding: 2 },
          columnStyles: { 0: { fontStyle: "bold", textColor: [80, 80, 80], cellWidth: 50 }, 1: { textColor: [40, 40, 40] } },
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      }

      // Fotos de la entrada
      try {
        // PASO 1: obtener las fotos via utils (forma correcta de fetch en async)
        const entryPhotos = await utils.visitPhotos.listByEntry.fetch({ entryId: e.entry.id });
        console.log(`[PDF] Entrada ${e.entry.id}: ${entryPhotos?.length || 0} fotos`);

        if (entryPhotos && entryPhotos.length > 0) {
          // PASO 2: pedir al servidor que las descargue y convierta a base64
          const res = await fetch("/api/photos-base64", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ urls: entryPhotos.map((p: any) => p.url) }),
          });
          if (!res.ok) {
            console.warn(`[PDF] Endpoint /api/photos-base64 falló: ${res.status}`);
          } else {
            const b64Photos = await res.json() as Array<{ url: string; base64: string } | null>;
            console.log(`[PDF] Recibidas ${b64Photos.length} fotos en base64`);
            const validPhotos = b64Photos.filter(p => p && p.base64);

            if (validPhotos.length > 0) {
              if (y > 220) { doc.addPage(); y = 20; }
              doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(80, 80, 80);
              doc.text("Fotografías:", 14, y); y += 5;

              const photoSize = 58; const cols = 3; const gap = 4;
              let col = 0;
              for (const b64Photo of validPhotos) {
                if (!b64Photo) continue;
                const photo = entryPhotos.find((p: any) => p.url === b64Photo.url);
                const x = 14 + col * (photoSize + gap);
                if (y + photoSize > 275) { doc.addPage(); y = 20; col = 0; }
                try {
                  // Pasamos data URI completo para que jsPDF lo detecte automáticamente
                  doc.addImage(`data:image/jpeg;base64,${b64Photo.base64}`, "JPEG", x, y, photoSize, photoSize);
                  if (photo?.caption) {
                    doc.setFontSize(7); doc.setFont("helvetica", "italic"); doc.setTextColor(80, 80, 80);
                    const captionLines = doc.splitTextToSize(photo.caption, photoSize);
                    doc.text(captionLines.slice(0, 2), x, y + photoSize + 4);
                  }
                } catch (imgErr) {
                  console.warn(`[PDF] Error añadiendo foto:`, imgErr);
                }
                col++;
                if (col >= cols) { col = 0; y += photoSize + 12; }
              }
              if (col > 0) y += photoSize + 12;
              y += 4;
            }
          }
        }
      } catch (err) {
        console.error("[PDF] Error cargando fotos:", err);
      }
    }

    if (report.internalNotes) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(80, 80, 80);
      doc.text("Notas internas del informe:", 14, y);
      y += 5;
      doc.setFont("helvetica", "normal"); doc.setTextColor(40, 40, 40);
      const lines = doc.splitTextToSize(report.internalNotes, 180);
      doc.text(lines, 14, y);
    }

    // Forzar descarga como PDF con nombre correcto
    const pdfBlob = doc.output("blob");
    const blobUrl = URL.createObjectURL(new Blob([pdfBlob], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `informe-visita-${format(new Date(report.dateStart), "yyyy-MM-dd")}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };

  return (
    <div className="flex-1 p-8">
      {/* Cabecera */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/visitas">
            <a className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
              <ChevronLeft className="w-5 h-5" />
            </a>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{report.title}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {format(new Date(report.dateStart), "dd MMM", { locale: es })} → {format(new Date(report.dateEnd), "dd MMM yyyy", { locale: es })}
              <span className={`ml-3 text-xs px-2 py-0.5 rounded-full font-medium ${report.status === "finalizado" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                {report.status}
              </span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {report.status === "borrador" && (
            <button
              onClick={() => updateReport.mutate({ id: reportId, status: "finalizado" })}
              className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm hover:bg-green-100"
            >
              <CheckCircle2 className="w-4 h-4" /> Finalizar
            </button>
          )}
          <button
            onClick={() => setShowPdfModal(true)}
            disabled={pdfGenerating}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-60"
          >
            <Download className="w-4 h-4" /> {pdfGenerating ? "Generando..." : "PDF"}
          </button>
          <button
            onClick={() => { if (confirm("¿Eliminar este informe?")) deleteReport.mutate({ id: reportId }); }}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Entradas */}
      <div className="space-y-3 mb-4">
        {entries.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Aún no hay entradas en este informe</p>
            <p className="text-xs text-gray-400 mt-1">Añade una entrada por cada finca o parcela visitada</p>
          </div>
        ) : (
          (entries as any[]).map((e: any) => (
            <div key={e.entry.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900">
                    {e.farm.name}
                    {e.parcel && <span className="text-gray-500 font-normal"> · {e.parcel.name}</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {format(new Date(e.entry.visitDate), "dd MMM yyyy", { locale: es })}
                    {e.entry.estadoFenologico && <span className="ml-2 px-2 py-0.5 bg-green-50 text-green-700 rounded-full">{e.entry.estadoFenologico}</span>}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditingEntry(e)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { if (confirm("¿Eliminar esta entrada?")) deleteEntry.mutate({ id: e.entry.id }); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 text-xs">
                {/* Scores */}
                {[
                  { label: "Vigor", val: e.entry.vigorVegetativo },
                  { label: "Color", val: e.entry.colorFoliaje },
                  { label: "Sanitario", val: e.entry.estadoSanitario },
                  { label: "Riego", val: e.entry.estadoRiego },
                ].some(s => s.val) && (
                  <div className="col-span-4 flex gap-4 mb-1">
                    {[
                      { label: "Vigor", val: e.entry.vigorVegetativo },
                      { label: "Color", val: e.entry.colorFoliaje },
                      { label: "Sanitario", val: e.entry.estadoSanitario },
                      { label: "Riego", val: e.entry.estadoRiego },
                    ].map(s => s.val ? (
                      <div key={s.label} className="flex items-center gap-1.5">
                        <span className="text-gray-400">{s.label}</span>
                        <ScoreBadge value={s.val} />
                      </div>
                    ) : null)}
                    {e.entry.presionFitosanitaria && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PRESION_COLOR[e.entry.presionFitosanitaria]}`}>
                        Presión {e.entry.presionFitosanitaria}
                      </span>
                    )}
                  </div>
                )}

                {/* Mediciones */}
                {(e.entry.brixGrados || e.entry.calibreMm || e.entry.firmezaKg || e.entry.porcentajeColor) && (
                  <div className="col-span-4 flex gap-4 text-xs bg-blue-50 rounded-lg px-3 py-2">
                    {e.entry.brixGrados && <span><span className="text-gray-500">Brix</span> <strong>{e.entry.brixGrados}°</strong></span>}
                    {e.entry.calibreMm && <span><span className="text-gray-500">Calibre</span> <strong>{e.entry.calibreMm}mm</strong></span>}
                    {e.entry.firmezaKg && <span><span className="text-gray-500">Firmeza</span> <strong>{e.entry.firmezaKg}kg</strong></span>}
                    {e.entry.porcentajeColor && <span><span className="text-gray-500">Color</span> <strong>{e.entry.porcentajeColor}%</strong></span>}
                    {e.entry.pesoMedioBaya && <span><span className="text-gray-500">Peso baya</span> <strong>{e.entry.pesoMedioBaya}g</strong></span>}
                  </div>
                )}

                {/* Plagas */}
                {(e.entry.plagasDetectadas || e.entry.enfermedadesDetectadas) && (
                  <div className="col-span-4 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
                    {e.entry.plagasDetectadas && <span>🐛 {e.entry.plagasDetectadas} </span>}
                    {e.entry.enfermedadesDetectadas && <span>🍄 {e.entry.enfermedadesDetectadas}</span>}
                  </div>
                )}

                {/* Texto */}
                {e.entry.tareasRealizadas && <div className="col-span-4"><span className="text-gray-400">Tareas: </span>{e.entry.tareasRealizadas}</div>}
                {e.entry.observaciones && <div className="col-span-4"><span className="text-gray-400">Obs: </span>{e.entry.observaciones}</div>}
                {e.entry.recomendaciones && <div className="col-span-4 text-green-700"><span className="text-gray-400">Rec: </span>{e.entry.recomendaciones}</div>}
              </div>
              <PhotosSection entryId={e.entry.id} />
            </div>
          ))
        )}
      </div>

      <button
        onClick={() => setShowEntry(true)}
        className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-green-300 hover:text-green-600 transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" /> Añadir entrada de visita
      </button>

      {/* Comparativa temporal por parcela/finca */}
      {entries.length >= 2 && (
        <div className="mt-6">
          <h2 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide text-gray-500">Evolución temporal</h2>
          {[...new Set((entries as any[]).map((e: any) => e.entry.farmId))].map((farmId: number) => {
            const farmEntries = (entries as any[]).filter((e: any) => e.entry.farmId === farmId);
            const farm = farmEntries[0]?.farm;
            const parcelIds = [...new Set(farmEntries.map((e: any) => e.entry.parcelId).filter(Boolean))];
            return (
              <div key={farmId} className="mb-4">
                {parcelIds.length > 0
                  ? parcelIds.map((pid: any) => {
                      const parcelName = farmEntries.find((e: any) => e.entry.parcelId === pid)?.parcel?.name || "Parcela";
                      return <ComparativaEvolucion key={pid} farmId={farmId} parcelId={pid} parcelName={`${farm?.name} · ${parcelName}`} />;
                    })
                  : <ComparativaEvolucion farmId={farmId} parcelName={farm?.name || "Finca"} />
                }
              </div>
            );
          })}
        </div>
      )}

      {/* Modal configuración PDF */}
      {showPdfModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-900">Configurar PDF</h2>
              <button onClick={() => setShowPdfModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Subtítulo / descripción del informe <span className="text-gray-400">(opcional)</span>
                </label>
                <input
                  value={pdfSubtitle}
                  onChange={e => setPdfSubtitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Ej: Detalle de cuajado de Melocotón variedad Royal Time"
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">Aparecerá en la cabecera verde del informe</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
                <p className="font-medium text-gray-700 mb-1">Formato del PDF:</p>
                <p>• 3 fotos por fila con descripción</p>
                <p>• Datos técnicos por parcela</p>
                <p>• Notas internas al final</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowPdfModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">Cancelar</button>
              <button
                onClick={async () => {
                  setShowPdfModal(false);
                  setPdfGenerating(true);
                  try { await generatePDF(pdfSubtitle); }
                  finally { setPdfGenerating(false); }
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download className="w-4 h-4" /> Generar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {(showEntry || editingEntry) && (
        <EntryModal
          reportId={reportId}
          farms={farms}
          existing={editingEntry}
          onClose={() => { setShowEntry(false); setEditingEntry(null); }}
          onSaved={() => refetch()}
        />
      )}
    </div>
  );
}

// ─── Modal nuevo informe ──────────────────────────────────────────────────────
function NewReportModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [title, setTitle] = useState("");
  const [dateStart, setDateStart] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dateEnd, setDateEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const create = trpc.visitReports.create.useMutation({
    onSuccess: (r) => { onCreated(r.id); onClose(); }
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-900">Nuevo informe de visita</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Título del informe *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className={ic} placeholder="Visita Sus-Masa — Abril 2025" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha inicio *</label>
              <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className={ic} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha fin *</label>
              <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className={ic} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">Cancelar</button>
          <button
            onClick={() => create.mutate({ title: title.trim(), dateStart: new Date(dateStart), dateEnd: new Date(dateEnd) })}
            disabled={!title.trim() || !dateStart || create.isPending}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            Crear informe
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Lista de informes ────────────────────────────────────────────────────────
function ReportList() {
  const [, navigate] = useLocation();
  const { data: reports = [], refetch } = trpc.visitReports.list.useQuery();
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="flex-1 p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-green-600" /> Visitas de campo
          </h1>
          <p className="text-sm text-gray-500 mt-1">Informes técnicos por campaña de visita</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
        >
          <Plus className="w-4 h-4" /> Nuevo informe
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-16 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Sin informes de visita</p>
          <p className="text-sm text-gray-400 mt-1">Crea tu primer informe para registrar una visita de campo</p>
          <button onClick={() => setShowNew(true)} className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
            Crear primer informe
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {(reports as any[]).map((r: any) => (
            <button
              key={r.id}
              onClick={() => navigate(`/visitas/${r.id}`)}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-left hover:border-green-200 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <p className="font-semibold text-gray-900">{r.title}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === "finalizado" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {r.status === "finalizado" ? <><CheckCircle2 className="w-3 h-3 inline mr-1" />Finalizado</> : <><Clock className="w-3 h-3 inline mr-1" />Borrador</>}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {format(new Date(r.dateStart), "dd MMM", { locale: es })} → {format(new Date(r.dateEnd), "dd MMM yyyy", { locale: es })}
              </p>
            </button>
          ))}
        </div>
      )}

      {showNew && (
        <NewReportModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => navigate(`/visitas/${id}`)}
        />
      )}
    </div>
  );
}

// ─── Componente raíz ──────────────────────────────────────────────────────────
export default function Visitas() {
  const [matchDetail, params] = useRoute("/visitas/:id");
  const reportId = matchDetail ? parseInt(params!.id) : null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      {reportId ? <ReportDetail reportId={reportId} /> : <ReportList />}
    </div>
  );
}

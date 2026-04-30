import { useState, useMemo } from "react";
import { Link } from "wouter";
import Sidebar from "../components/Sidebar";
import { trpc } from "../lib/trpc";
import { format, isToday, isTomorrow, isPast, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Search, Filter, X, ClipboardList, Plus, Calendar, MapPin, CheckCircle2, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

function normalize(s) { return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(); }

const PRESION_COLOR = { baja: "bg-green-100 text-green-700", media: "bg-amber-100 text-amber-700", alta: "bg-orange-100 text-orange-700", "crítica": "bg-red-100 text-red-700" };
const SCORE_COLORS = ["", "bg-red-100 text-red-700", "bg-orange-100 text-orange-700", "bg-amber-100 text-amber-700", "bg-lime-100 text-lime-700", "bg-green-100 text-green-700"];
const PRIORITY_STYLE = { alta: "bg-red-100 text-red-700 border-red-200", media: "bg-amber-100 text-amber-700 border-amber-200", baja: "bg-gray-100 text-gray-600 border-gray-200" };
const ic = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white";

function ScoreBadge({ v, label }) {
  if (!v) return null;
  return <span className="flex items-center gap-1 text-xs"><span className="text-gray-400">{label}</span><span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${SCORE_COLORS[v]}`}>{v}</span></span>;
}

// ══════════════════════════════════════════════════════════════════
// REVISIONES
// ══════════════════════════════════════════════════════════════════
export function Reviews() {
  const { data: entries = [] } = trpc.visitReports.allEntries.useQuery();
  const [search, setSearch] = useState("");
  const [filterFarm, setFilterFarm] = useState("");
  const [filterFenofase, setFilterFenofase] = useState("");
  const [filterPresion, setFilterPresion] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const farmOptions = [...new Set(entries.map((e) => e.farm.name))].sort();
  const fenofaseOptions = [...new Set(entries.map((e) => e.entry.estadoFenologico).filter(Boolean))].sort();

  const filtered = useMemo(() => entries.filter((e) => {
    const q = normalize(search);
    if (q && !normalize(e.farm.name).includes(q) && !normalize(e.entry.estadoFenologico || "").includes(q) && !normalize(e.entry.observaciones || "").includes(q) && !normalize(e.parcel?.name || "").includes(q)) return false;
    if (filterFarm && e.farm.name !== filterFarm) return false;
    if (filterFenofase && e.entry.estadoFenologico !== filterFenofase) return false;
    if (filterPresion && e.entry.presionFitosanitaria !== filterPresion) return false;
    return true;
  }).sort((a, b) => new Date(b.entry.visitDate).getTime() - new Date(a.entry.visitDate).getTime()),
  [entries, search, filterFarm, filterFenofase, filterPresion]);

  const thisMonth = entries.filter((e) => { const d = new Date(e.entry.visitDate); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); });
  const vigores = filtered.filter((e) => e.entry.vigorVegetativo);
  const avgVigor = vigores.length > 0 ? (vigores.reduce((s, e) => s + e.entry.vigorVegetativo, 0) / vigores.length).toFixed(1) : "—";

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><ClipboardList className="w-6 h-6 text-green-600" /> Revisiones</h1><p className="text-sm text-gray-500 mt-1">Histórico global de todas las entradas de visita</p></div>
          <Link href="/visitas"><a className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"><Plus className="w-4 h-4" /> Nueva visita</a></Link>
        </div>
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[{ label: "Total entradas", value: entries.length, color: "text-green-600" }, { label: "Este mes", value: thisMonth.length, color: "text-blue-600" }, { label: "Fincas visitadas", value: new Set(entries.map((e) => e.entry.farmId)).size, color: "text-purple-600" }, { label: "Vigor medio", value: avgVigor, color: "text-amber-600" }].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4"><p className={`text-2xl font-bold ${s.color}`}>{s.value}</p><p className="text-xs text-gray-500 mt-0.5">{s.label}</p></div>
          ))}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
          <div className="flex gap-3 mb-2">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar finca, parcela, observaciones..." className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" /></div>
            <button onClick={() => setShowFilters(f => !f)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border ${showFilters || filterFarm || filterFenofase || filterPresion ? "bg-green-600 text-white border-green-600" : "border-gray-200 text-gray-600 hover:border-green-300"}`}><Filter className="w-4 h-4" /> Filtros</button>
          </div>
          {showFilters && (
            <div className="flex gap-3 pt-3 border-t border-gray-100 flex-wrap">
              {[{ label: "Finca", value: filterFarm, set: setFilterFarm, opts: farmOptions }, { label: "Fenofase", value: filterFenofase, set: setFilterFenofase, opts: fenofaseOptions }, { label: "Presión", value: filterPresion, set: setFilterPresion, opts: ["baja", "media", "alta", "crítica"] }].map(f => (
                <div key={f.label}><label className="text-xs text-gray-500 block mb-1">{f.label}</label><select value={f.value} onChange={e => f.set(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none min-w-[140px]"><option value="">Todos</option>{f.opts.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
              ))}
              {(filterFarm || filterFenofase || filterPresion) && <div className="flex items-end"><button onClick={() => { setFilterFarm(""); setFilterFenofase(""); setFilterPresion(""); }} className="text-xs text-red-500 hover:text-red-700 pb-2">Limpiar</button></div>}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-3 px-1">{filtered.length} entradas</p>
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center"><ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-2" /><p className="text-gray-400 text-sm">No hay entradas de visita registradas</p><Link href="/visitas"><a className="mt-3 inline-block text-sm text-green-600 hover:underline">Crear primera visita →</a></Link></div>
          ) : filtered.map((e) => (
            <div key={e.entry.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-green-200 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2"><Link href={`/fincas/${e.entry.farmId}`}><a className="font-semibold text-gray-900 hover:text-green-700 text-sm">{e.farm.name}</a></Link>{e.parcel && <span className="text-gray-400 text-sm">· {e.parcel.name}</span>}{e.entry.estadoFenologico && <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full">{e.entry.estadoFenologico}</span>}</div>
                  <p className="text-xs text-gray-400 mt-0.5">{format(new Date(e.entry.visitDate), "dd MMM yyyy", { locale: es })}</p>
                </div>
                <div className="flex gap-3"><ScoreBadge v={e.entry.vigorVegetativo} label="Vigor" /><ScoreBadge v={e.entry.colorFoliaje} label="Color" /><ScoreBadge v={e.entry.estadoSanitario} label="Sanidad" />{e.entry.presionFitosanitaria && <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${PRESION_COLOR[e.entry.presionFitosanitaria]}`}>{e.entry.presionFitosanitaria}</span>}</div>
              </div>
              {(e.entry.brixGrados || e.entry.calibreMm || e.entry.firmezaKg) && (
                <div className="flex gap-4 text-xs bg-blue-50 rounded-lg px-3 py-1.5 mb-2">
                  {e.entry.brixGrados && <span><span className="text-gray-500">Brix</span> <strong>{e.entry.brixGrados}°</strong></span>}
                  {e.entry.calibreMm && <span><span className="text-gray-500">Calibre</span> <strong>{e.entry.calibreMm}mm</strong></span>}
                  {e.entry.firmezaKg && <span><span className="text-gray-500">Firmeza</span> <strong>{e.entry.firmezaKg}kg</strong></span>}
                  {e.entry.porcentajeColor && <span><span className="text-gray-500">Color</span> <strong>{e.entry.porcentajeColor}%</strong></span>}
                </div>
              )}
              <div className="text-xs text-gray-500 space-y-0.5">
                {e.entry.observaciones && <p><span className="text-gray-400">Obs:</span> {e.entry.observaciones}</p>}
                {e.entry.recomendaciones && <p className="text-green-700"><span className="text-gray-400">Rec:</span> {e.entry.recomendaciones}</p>}
                {e.entry.plagasDetectadas && <p className="text-red-600">🐛 {e.entry.plagasDetectadas}</p>}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAREAS
// ══════════════════════════════════════════════════════════════════
function TaskModal({ farms, onClose, onSaved, existing }) {
  const [farmId, setFarmId] = useState(existing?.task.farmId ?? "");
  const [title, setTitle] = useState(existing?.task.title ?? "");
  const [description, setDescription] = useState(existing?.task.description ?? "");
  const [dueDate, setDueDate] = useState(existing ? format(new Date(existing.task.dueDate), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
  const [priority, setPriority] = useState(existing?.task.priority ?? "media");
  const create = trpc.tasks.create.useMutation({ onSuccess: () => { onSaved(); onClose(); } });
  const update = trpc.tasks.update.useMutation({ onSuccess: () => { onSaved(); onClose(); } });
  const handleSave = () => {
    if (!farmId || !title.trim()) return;
    const payload = { farmId: parseInt(farmId), title: title.trim(), description: description || undefined, dueDate: new Date(dueDate), priority };
    if (existing) update.mutate({ id: existing.task.id, ...payload });
    else create.mutate(payload);
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5"><h2 className="font-semibold text-gray-900">{existing ? "Editar visita planificada" : "Nueva visita planificada"}</h2><button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button></div>
        <div className="space-y-3">
          <div><label className="text-xs text-gray-500 block mb-1">Finca *</label><select value={farmId} onChange={e => setFarmId(e.target.value)} className={ic}><option value="">Selecciona finca...</option>{farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
          <div><label className="text-xs text-gray-500 block mb-1">Título *</label><input value={title} onChange={e => setTitle(e.target.value)} className={ic} placeholder="Visita de seguimiento, Toma de muestras..." /></div>
          <div><label className="text-xs text-gray-500 block mb-1">Notas</label><textarea value={description} onChange={e => setDescription(e.target.value)} className={ic} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">Fecha *</label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={ic} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Prioridad</label><select value={priority} onChange={e => setPriority(e.target.value)} className={ic}><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5"><button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">Cancelar</button><button onClick={handleSave} disabled={!farmId || !title.trim()} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">{existing ? "Guardar" : "Crear"}</button></div>
      </div>
    </div>
  );
}

export function Tasks() {
  const { data: allTasks = [], refetch } = trpc.tasks.listAll.useQuery();
  const { data: farms = [] } = trpc.farms.list.useQuery();
  const updateTask = trpc.tasks.update.useMutation({ onSuccess: () => refetch() });
  const deleteTask = trpc.tasks.delete.useMutation({ onSuccess: () => refetch() });
  const [view, setView] = useState("lista");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterFarm, setFilterFarm] = useState("");
  const [filterStatus, setFilterStatus] = useState("pendiente");
  const [calMonth, setCalMonth] = useState(new Date());

  const pending = allTasks.filter((t) => !t.task.isCompleted);
  const overdue = pending.filter((t) => isPast(new Date(t.task.dueDate)) && !isToday(new Date(t.task.dueDate)));

  const filtered = useMemo(() => allTasks.filter((t) => {
    if (filterFarm && t.farm.name !== filterFarm) return false;
    if (filterStatus === "pendiente" && t.task.isCompleted) return false;
    if (filterStatus === "completada" && !t.task.isCompleted) return false;
    return true;
  }).sort((a, b) => new Date(a.task.dueDate).getTime() - new Date(b.task.dueDate).getTime()),
  [allTasks, filterFarm, filterStatus]);

  const farmOptions = [...new Set(allTasks.map((t) => t.farm.name))].sort();
  const daysInMonth = eachDayOfInterval({ start: startOfMonth(calMonth), end: endOfMonth(calMonth) });
  const firstDayOfWeek = (getDay(startOfMonth(calMonth)) + 6) % 7;
  const tasksByDate = useMemo(() => {
    const map = {};
    allTasks.forEach((t) => { const key = format(new Date(t.task.dueDate), "yyyy-MM-dd"); if (!map[key]) map[key] = []; map[key].push(t); });
    return map;
  }, [allTasks]);

  function dueDateLabel(date) {
    if (isToday(date)) return <span className="text-xs text-blue-600 font-medium">Hoy</span>;
    if (isTomorrow(date)) return <span className="text-xs text-amber-600 font-medium">Mañana</span>;
    if (isPast(date)) return <span className="text-xs text-red-600 font-medium">Vencida</span>;
    return <span className="text-xs text-gray-400">{format(date, "dd MMM", { locale: es })}</span>;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Calendar className="w-6 h-6 text-green-600" /> Cronograma de visitas</h1><p className="text-sm text-gray-500 mt-1">{pending.length} visitas pendientes{overdue.length > 0 && <span className="ml-2 text-red-600 font-medium">· {overdue.length} vencidas</span>}</p></div>
          <div className="flex gap-2">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">{["lista", "calendario"].map(v => <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 text-xs rounded-md capitalize transition-all ${view === v ? "bg-white shadow font-medium" : "text-gray-500"}`}>{v}</button>)}</div>
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"><Plus className="w-4 h-4" /> Nueva visita</button>
          </div>
        </div>

        {view === "lista" && (
          <>
            <div className="flex gap-3 mb-4">
              <select value={filterFarm} onChange={e => setFilterFarm(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none"><option value="">Todas las fincas</option>{farmOptions.map(f => <option key={f} value={f}>{f}</option>)}</select>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">{["todas", "pendiente", "completada"].map(s => <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1 text-xs rounded-md capitalize transition-all ${filterStatus === s ? "bg-white shadow font-medium" : "text-gray-500"}`}>{s}</button>)}</div>
            </div>
            <div className="space-y-2">
              {filtered.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center"><Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" /><p className="text-gray-400 text-sm">No hay visitas planificadas</p><button onClick={() => setShowModal(true)} className="mt-3 text-sm text-green-600 hover:underline">Planificar primera visita →</button></div>
              ) : filtered.map((t) => {
                const due = new Date(t.task.dueDate);
                const isOverdue = isPast(due) && !isToday(due) && !t.task.isCompleted;
                return (
                  <div key={t.task.id} className={`bg-white rounded-xl border shadow-sm p-4 flex items-start gap-3 ${isOverdue ? "border-red-200" : "border-gray-100"} ${t.task.isCompleted ? "opacity-60" : ""}`}>
                    <button onClick={() => updateTask.mutate({ id: t.task.id, isCompleted: !t.task.isCompleted })} className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${t.task.isCompleted ? "bg-green-600 border-green-600" : "border-gray-300 hover:border-green-400"}`}>{t.task.isCompleted && <CheckCircle2 className="w-3 h-3 text-white" />}</button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={`font-medium text-sm ${t.task.isCompleted ? "line-through text-gray-400" : "text-gray-900"}`}>{t.task.title}</p>
                          <div className="flex items-center gap-2 mt-0.5"><Link href={`/fincas/${t.task.farmId}`}><a className="text-xs text-green-600 hover:underline flex items-center gap-1"><MapPin className="w-3 h-3" />{t.farm.name}</a></Link>{dueDateLabel(due)}<span className={`text-xs px-1.5 py-0.5 rounded border capitalize ${PRIORITY_STYLE[t.task.priority]}`}>{t.task.priority}</span></div>
                          {t.task.description && <p className="text-xs text-gray-400 mt-1">{t.task.description}</p>}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => setEditing(t)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"><Calendar className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { if (confirm("¿Eliminar?")) deleteTask.mutate({ id: t.task.id }); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      {!t.task.isCompleted && <Link href="/visitas"><a className="mt-2 inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2.5 py-1 rounded-lg hover:bg-green-100"><Plus className="w-3 h-3" /> Registrar visita ahora</a></Link>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {view === "calendario" && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <button onClick={() => setCalMonth(m => subMonths(m, 1))} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft className="w-4 h-4" /></button>
              <h2 className="font-semibold text-gray-900 capitalize">{format(calMonth, "MMMM yyyy", { locale: es })}</h2>
              <button onClick={() => setCalMonth(m => addMonths(m, 1))} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-7 border-b border-gray-100">{["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">{d}</div>)}</div>
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e-${i}`} className="border-b border-r border-gray-50 h-24" />)}
              {daysInMonth.map(day => {
                const key = format(day, "yyyy-MM-dd");
                const dayTasks = tasksByDate[key] || [];
                const isCurrent = isToday(day);
                return (
                  <div key={key} className={`border-b border-r border-gray-50 h-24 p-1.5 ${isCurrent ? "bg-green-50" : ""}`}>
                    <p className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isCurrent ? "bg-green-600 text-white" : "text-gray-500"}`}>{format(day, "d")}</p>
                    <div className="space-y-0.5 overflow-hidden">
                      {dayTasks.slice(0, 3).map((t) => <div key={t.task.id} className={`text-xs px-1.5 py-0.5 rounded truncate ${t.task.isCompleted ? "bg-gray-100 text-gray-400 line-through" : PRIORITY_STYLE[t.task.priority]}`}>{t.farm.name}</div>)}
                      {dayTasks.length > 3 && <p className="text-xs text-gray-400">+{dayTasks.length - 3}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
      {(showModal || editing) && <TaskModal farms={farms} existing={editing} onClose={() => { setShowModal(false); setEditing(null); }} onSaved={() => refetch()} />}
    </div>
  );
}

export function NotFound() {
  return (
    <div className="flex min-h-screen"><Sidebar /><main className="flex-1 flex items-center justify-center"><div className="text-center"><p className="text-6xl font-bold text-gray-200 mb-4">404</p><p className="text-gray-500">Página no encontrada</p><a href="/dashboard" className="mt-4 inline-block px-4 py-2 bg-green-600 text-white rounded-lg text-sm">Volver al inicio</a></div></main></div>
  );
}

export function Crops() {
  const { data: farms = [] } = trpc.farms.list.useQuery();
  return (
    <div className="flex min-h-screen"><Sidebar /><main className="flex-1 p-8"><h1 className="text-2xl font-bold text-gray-900 mb-6">Cultivos</h1><p className="text-gray-500 mb-4">Selecciona una finca para ver sus parcelas.</p><div className="grid grid-cols-2 gap-4">{farms.map(f => <Link key={f.id} href={`/fincas/${f.id}`}><a className="bg-white rounded-xl border border-gray-100 p-4 hover:border-green-200 transition-colors block"><p className="font-semibold text-gray-900">{f.name}</p><p className="text-sm text-gray-500">{f.location} · {f.totalHectares} ha</p></a></Link>)}</div></main></div>
  );
}

export default NotFound;

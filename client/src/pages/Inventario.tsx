import { useState, useMemo } from "react";
import { Link } from "wouter";
import Sidebar from "../components/Sidebar";
import { trpc } from "../lib/trpc";
import { Search, Filter, X, ChevronRight, Download, Layers } from "lucide-react";
import { format } from "date-fns";

// ─── Tipos locales ────────────────────────────────────────────────────────────
interface FarmRow {
  farmId: number;
  farmName: string;
  location: string;
  totalHectares: string | null;
  // datos del JSON description
  pais: string;
  region: string;
  especie: string;
  variedad: string;
  superficie: string;
  anyoPlantacion: string;
  conduccion: string;
  irrigationType: string;
  // parcelas
  parcelas: ParcelRow[];
}

interface ParcelRow {
  id: number;
  name: string;
  especie: string;
  variedad: string;
  surface: string;
  anyoPlantacion: string;
  conduccion: string;
  densidad: string;
  ph: string;
  tipoSuelo: string;
}

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

// ─── Chip de filtro activo ────────────────────────────────────────────────────
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-200">
      {label}
      <button onClick={onRemove} className="hover:text-green-900">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// ─── Selector de filtro ───────────────────────────────────────────────────────
function FilterSelect({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500 font-medium">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 min-w-[140px]"
      >
        <option value="">Todos</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ─── Fila expandible de finca ─────────────────────────────────────────────────
function FarmRowItem({ farm, showParcelas }: { farm: FarmRow; showParcelas: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const totalSup = farm.parcelas.length > 0
    ? farm.parcelas.reduce((s, p) => s + parseFloat(p.surface || "0"), 0)
    : parseFloat(farm.superficie || farm.totalHectares || "0");

  return (
    <>
      <tr
        className="border-b border-gray-50 hover:bg-green-50/30 transition-colors cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-2">
            {farm.parcelas.length > 1 && (
              <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`} />
            )}
            <div>
              <Link href={`/fincas/${farm.farmId}`}>
                <a
                  className="font-semibold text-gray-900 hover:text-green-700 text-sm"
                  onClick={e => e.stopPropagation()}
                >
                  {farm.farmName}
                </a>
              </Link>
              <p className="text-xs text-gray-400 mt-0.5">{farm.location}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3.5 text-sm text-gray-600">{farm.pais || "—"}</td>
        <td className="px-4 py-3.5 text-sm text-gray-600">{farm.region || "—"}</td>
        <td className="px-4 py-3.5">
          {farm.especie
            ? <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-medium">{farm.especie}</span>
            : <span className="text-gray-300 text-xs">—</span>
          }
        </td>
        <td className="px-4 py-3.5 text-sm text-gray-700">{farm.variedad || "—"}</td>
        <td className="px-4 py-3.5 text-right">
          <span className="font-semibold text-gray-900 text-sm">
            {totalSup > 0 ? `${totalSup.toFixed(2)} ha` : "—"}
          </span>
          {farm.parcelas.length > 1 && (
            <p className="text-xs text-gray-400">{farm.parcelas.length} parcelas</p>
          )}
        </td>
        <td className="px-4 py-3.5 text-sm text-gray-600 text-center">{farm.anyoPlantacion || "—"}</td>
        <td className="px-4 py-3.5 text-sm text-gray-600">{farm.conduccion || "—"}</td>
        <td className="px-4 py-3.5 text-sm text-gray-600">{farm.irrigationType || "—"}</td>
      </tr>
      {expanded && farm.parcelas.length > 1 && farm.parcelas.map(p => (
        <tr key={p.id} className="bg-green-50/40 border-b border-green-100/50">
          <td className="px-5 py-2.5 pl-12">
            <p className="text-sm font-medium text-gray-700">{p.name}</p>
          </td>
          <td className="px-4 py-2.5 text-xs text-gray-400">↳ parcela</td>
          <td className="px-4 py-2.5"></td>
          <td className="px-4 py-2.5">
            {p.especie && <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">{p.especie}</span>}
          </td>
          <td className="px-4 py-2.5 text-xs text-gray-600">{p.variedad || "—"}</td>
          <td className="px-4 py-2.5 text-right text-sm font-medium text-gray-700">
            {p.surface ? `${parseFloat(p.surface).toFixed(2)} ha` : "—"}
          </td>
          <td className="px-4 py-2.5 text-xs text-center text-gray-500">{p.anyoPlantacion || "—"}</td>
          <td className="px-4 py-2.5 text-xs text-gray-500">{p.conduccion || "—"}</td>
          <td className="px-4 py-2.5 text-xs text-gray-400">
            {p.densidad ? `${p.densidad} pl/ha` : ""}
            {p.ph ? ` · pH ${p.ph}` : ""}
          </td>
        </tr>
      ))}
    </>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Inventario() {
  const { data: farms = [] } = trpc.farms.list.useQuery();
  const { data: allParcels = [] } = trpc.parcels.listAll.useQuery();

  // Filtros
  const [search, setSearch] = useState("");
  const [filterPais, setFilterPais] = useState("");
  const [filterEspecie, setFilterEspecie] = useState("");
  const [filterVariedad, setFilterVariedad] = useState("");
  const [filterRegion, setFilterRegion] = useState("");
  const [filterConduccion, setFilterConduccion] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Construir filas combinando fincas + parcelas
  const rows: FarmRow[] = useMemo(() => {
    return farms.map(farm => {
      let extra: any = {};
      try { extra = JSON.parse(farm.description || "{}"); } catch {}

      const farmParcels = (allParcels as any[])
        .filter((p: any) => p.parcel.farmId === farm.id)
        .map((p: any) => ({
          id: p.parcel.id,
          name: p.parcel.name,
          especie: p.parcel.especie || "",
          variedad: p.parcel.variedad || "",
          surface: p.parcel.surface || "",
          anyoPlantacion: p.parcel.anyoPlantacion?.toString() || "",
          conduccion: p.parcel.conduccion || "",
          densidad: p.parcel.densidad?.toString() || "",
          ph: p.parcel.ph || "",
          tipoSuelo: p.parcel.tipoSuelo || "",
        }));

      // Especie/variedad: desde parcelas si las hay, si no desde ficha
      const mainEspecie = farmParcels.length > 0
        ? farmParcels.map((p: ParcelRow) => p.especie).filter(Boolean).join(", ")
        : extra.especie || "";
      const mainVariedad = farmParcels.length === 1
        ? farmParcels[0].variedad
        : farmParcels.length > 1
          ? farmParcels.map((p: ParcelRow) => p.variedad).filter(Boolean).join(", ")
          : extra.variedad || "";

      // País y región desde location (formato "Ciudad, Región, País")
      const locationParts = (farm.location || "").split(",").map((s: string) => s.trim());
      const pais = locationParts[locationParts.length - 1] || "";
      const region = locationParts.length >= 3 ? locationParts[locationParts.length - 2] : "";

      return {
        farmId: farm.id,
        farmName: farm.name,
        location: farm.location || "",
        totalHectares: farm.totalHectares,
        pais,
        region,
        especie: mainEspecie,
        variedad: mainVariedad,
        superficie: extra.superficie || "",
        anyoPlantacion: farmParcels.length === 1
          ? farmParcels[0].anyoPlantacion
          : extra.anyoPlantacion || "",
        conduccion: farmParcels.length === 1
          ? farmParcels[0].conduccion
          : extra.conduccion || "",
        irrigationType: extra.irrigationType || "",
        parcelas: farmParcels,
      };
    });
  }, [farms, allParcels]);

  // Opciones únicas para filtros
  const uniqueValues = (key: keyof FarmRow) =>
    [...new Set(rows.map(r => String(r[key] || "")).filter(Boolean))].sort();

  const paisOptions = uniqueValues("pais");
  const regionOptions = uniqueValues("region");
  const especieOptions = [...new Set(rows.flatMap(r =>
    r.especie.split(",").map(s => s.trim()).filter(Boolean)
  ))].sort();
  const variedadOptions = [...new Set(rows.flatMap(r =>
    r.variedad.split(",").map(s => s.trim()).filter(Boolean)
  ))].sort();
  const conduccionOptions = [...new Set(rows.flatMap(r =>
    r.conduccion.split(",").map(s => s.trim()).filter(Boolean)
  ))].sort();

  // Filtrado
  const filtered = useMemo(() => {
    return rows.filter(r => {
      const q = normalize(search);
      if (q && !normalize(r.farmName).includes(q) && !normalize(r.location).includes(q) &&
          !normalize(r.especie).includes(q) && !normalize(r.variedad).includes(q)) return false;
      if (filterPais && r.pais !== filterPais) return false;
      if (filterRegion && r.region !== filterRegion) return false;
      if (filterEspecie && !r.especie.includes(filterEspecie)) return false;
      if (filterVariedad && !r.variedad.includes(filterVariedad)) return false;
      if (filterConduccion && !r.conduccion.includes(filterConduccion)) return false;
      return true;
    });
  }, [rows, search, filterPais, filterEspecie, filterVariedad, filterConduccion]);

  // Totales dinámicos
  const totalHa = filtered.reduce((s, r) => {
    if (r.parcelas.length > 0) {
      return s + r.parcelas.reduce((ps, p) => ps + parseFloat(p.surface || "0"), 0);
    }
    return s + parseFloat(r.superficie || r.totalHectares || "0");
  }, 0);

  const activeFilters = [
    filterPais && { label: `País: ${filterPais}`, clear: () => setFilterPais("") },
    filterRegion && { label: `Región: ${filterRegion}`, clear: () => setFilterRegion("") },
    filterEspecie && { label: `Especie: ${filterEspecie}`, clear: () => setFilterEspecie("") },
    filterVariedad && { label: `Variedad: ${filterVariedad}`, clear: () => setFilterVariedad("") },
    filterConduccion && { label: `Conducción: ${filterConduccion}`, clear: () => setFilterConduccion("") },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  // Export CSV (con BOM para que Excel en Windows lo abra correctamente)
  const exportCSV = () => {
    const headers = ["Finca", "Ubicación", "País", "Región", "Especie", "Variedad", "Superficie (ha)", "Año plantación", "Conducción", "Riego"];
    const rows_csv = filtered.map(r => {
      const sup = r.parcelas.length > 0
        ? r.parcelas.reduce((s, p) => s + parseFloat(p.surface || "0"), 0).toFixed(2)
        : parseFloat(r.superficie || r.totalHectares || "0").toFixed(2);
      return [r.farmName, r.location, r.pais, r.region, r.especie, r.variedad, sup, r.anyoPlantacion, r.conduccion, r.irrigationType];
    });
    const csv = [headers, ...rows_csv].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "inventario-fincas.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        {/* Cabecera */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Layers className="w-6 h-6 text-green-600" />
              Inventario global
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Todas las fincas · Filtrable por país, especie, variedad y conducción
            </p>
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
        </div>

        {/* Buscador + filtros */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar finca, ubicación, especie, variedad..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              onClick={() => setShowFilters(f => !f)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                activeFilters.length > 0
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-green-300"
              }`}
            >
              <Filter className="w-4 h-4" />
              Filtros {activeFilters.length > 0 && `(${activeFilters.length})`}
            </button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-4 pt-3 border-t border-gray-100">
              <FilterSelect label="País" value={filterPais} options={paisOptions} onChange={setFilterPais} />
              <FilterSelect label="Región" value={filterRegion} options={regionOptions} onChange={setFilterRegion} />
              <FilterSelect label="Especie" value={filterEspecie} options={especieOptions} onChange={setFilterEspecie} />
              <FilterSelect label="Variedad" value={filterVariedad} options={variedadOptions} onChange={setFilterVariedad} />
              <FilterSelect label="Conducción" value={filterConduccion} options={conduccionOptions} onChange={setFilterConduccion} />
              {activeFilters.length > 0 && (
                <div className="flex items-end">
                  <button
                    onClick={() => { setFilterPais(""); setFilterEspecie(""); setFilterVariedad(""); setFilterConduccion(""); }}
                    className="text-xs text-red-500 hover:text-red-700 pb-2"
                  >
                    Limpiar todo
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Chips de filtros activos */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {activeFilters.map(f => (
                <FilterChip key={f.label} label={f.label} onRemove={f.clear} />
              ))}
            </div>
          )}
        </div>

        {/* Resumen dinámico */}
        <div className="flex items-center gap-6 mb-4 px-1">
          <p className="text-sm text-gray-500">
            Mostrando <span className="font-semibold text-gray-900">{filtered.length}</span> fincas
          </p>
          {totalHa > 0 && (
            <p className="text-sm text-gray-500">
              Total: <span className="font-semibold text-gray-900">{totalHa.toFixed(2)} ha</span>
            </p>
          )}
          {filterEspecie && (
            <p className="text-sm text-gray-500">
              Especie filtrada: <span className="font-semibold text-green-700">{filterEspecie}</span>
            </p>
          )}
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Finca</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">País</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Región</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Especie</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Variedad</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Superficie</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Plantación</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Conducción</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Riego</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-gray-400">
                      No se encontraron fincas con los filtros aplicados
                    </td>
                  </tr>
                ) : (
                  filtered.map(farm => (
                    <FarmRowItem key={farm.farmId} farm={farm} showParcelas={true} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer con totales */}
          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-500">{filtered.length} fincas</p>
              <p className="text-sm font-semibold text-gray-900">
                Total: {totalHa.toFixed(2)} ha
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

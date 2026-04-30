import Sidebar from "../components/Sidebar";
import { trpc } from "../lib/trpc";
import { MapPin, Sprout, ClipboardList, CheckSquare, Download, Snowflake, ThermometerSun, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "wouter";

function ComparativaClimatica() {
  // Por defecto: período de acumulación de frío de la temporada actual
  const today = new Date();
  const month = today.getMonth();
  const year = today.getFullYear();
  const startYear = month >= 9 ? year : year - 1;
  const startDate = `${startYear}-10-01`;
  const endDate = `${startYear + 1}-03-31`;

  const { data, isLoading } = trpc.climate.compareFarms.useQuery(
    { startDate, endDate },
    { staleTime: 30 * 60 * 1000, refetchOnWindowFocus: false }
  );

  if (isLoading) return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin text-green-600" />
        <p className="text-sm">Cargando comparativa climática...</p>
      </div>
    </div>
  );

  if (!data || data.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-6">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Snowflake className="w-4 h-4 text-blue-600" /> Comparativa climática entre fincas
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Período: {format(new Date(startDate), "MMM yyyy", { locale: es })} – {format(new Date(endDate), "MMM yyyy", { locale: es })}</p>
          </div>
          <span className="text-xs text-gray-400">Datos: Open-Meteo</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Finca</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Cultivo</th>
              <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Chill Portions</th>
              <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">vs requerido</th>
              <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">T media</th>
              <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Precipitación</th>
              <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Heladas</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d: any) => {
              const pct = d.requerimientoFrio ? Math.round((d.chillPortions / d.requerimientoFrio) * 100) : null;
              const status = pct === null ? "gray" : pct >= 100 ? "green" : pct >= 70 ? "amber" : "red";
              const colors = { green: "text-green-700 bg-green-50", amber: "text-amber-700 bg-amber-50", red: "text-red-700 bg-red-50", gray: "text-gray-500 bg-gray-50" };
              return (
                <tr key={d.farmId} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/fincas/${d.farmId}`}>
                      <a className="font-medium text-gray-900 hover:text-green-700">{d.farmName}</a>
                    </Link>
                    <p className="text-xs text-gray-500">{d.location}</p>
                  </td>
                  <td className="px-4 py-3">
                    {d.especie && <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full">{d.especie}</span>}
                    {d.variedad && <p className="text-xs text-gray-500 mt-0.5">{d.variedad}</p>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{d.chillPortions.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right">
                    {pct !== null
                      ? <span className={`text-xs px-2 py-1 rounded-full font-medium ${colors[status]}`}>{pct}% de {d.requerimientoFrio} CP</span>
                      : <span className="text-xs text-gray-400">Sin objetivo</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right">{d.tmean.toFixed(1)}°C</td>
                  <td className="px-4 py-3 text-right">{d.totalPrecipitation.toFixed(0)}mm</td>
                  <td className="px-4 py-3 text-right">{d.frostDays > 0 ? <span className="text-blue-600 font-medium">{d.frostDays} días</span> : <span className="text-gray-400">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

export default function Dashboard() {
  const { data: farms = [] } = trpc.farms.list.useQuery();
  const { data: reviews = [] } = trpc.reviews.allReviews.useQuery();
  const { data: user } = trpc.auth.me.useQuery();

  const totalHectares = farms.reduce((s, f) => s + parseFloat(f.totalHectares || "0"), 0);

  const generatePDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF();

    // Logo placeholder area
    doc.setFillColor(21, 128, 61);
    doc.rect(0, 0, 210, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("AgriVisit", 14, 18);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Informe de Resumen", 14, 25);

    // Company name + logo space
    if (user?.companyName) {
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text(user.companyName, 196, 18, { align: "right" });
    }

    // Reset colors
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);

    // Date
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generado el ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es })}`, 14, 38);

    // Stats
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text("Resumen General", 14, 50);

    autoTable(doc, {
      startY: 55,
      head: [["Indicador", "Valor"]],
      body: [
        ["Total de fincas", farms.length.toString()],
        ["Total de hectáreas", `${totalHectares.toFixed(2)} ha`],
        ["Total de revisiones", reviews.length.toString()],
      ],
      theme: "grid",
      headStyles: { fillColor: [21, 128, 61] },
    });

    // Farms table
    if (farms.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.text("Detalle de Fincas", 14, (doc as any).lastAutoTable.finalY + 15);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [["Finca", "Ubicación", "Hectáreas"]],
        body: farms.map(f => [f.name, f.location || "-", `${f.totalHectares || 0} ha`]),
        theme: "striped",
        headStyles: { fillColor: [21, 128, 61] },
      });
    }

    doc.save(`agrivisit-resumen-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">Bienvenido, {user?.name}</p>
          </div>
          <button onClick={generatePDF} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
            <Download className="w-4 h-4" />
            Descargar informe PDF
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={MapPin} label="Fincas registradas" value={farms.length} color="bg-green-600" />
          <StatCard icon={Sprout} label="Hectáreas totales" value={Math.round(totalHectares)} color="bg-emerald-600" />
          <StatCard icon={ClipboardList} label="Revisiones totales" value={reviews.length} color="bg-teal-600" />
          <StatCard icon={CheckSquare} label="Revisiones este mes" value={reviews.filter(r => new Date(r.createdAt).getMonth() === new Date().getMonth()).length} color="bg-cyan-600" />
        </div>

        <ComparativaClimatica />

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Últimas revisiones</h2>
          </div>
          {reviews.length === 0 ? (
            <p className="text-center text-gray-400 py-12">No hay revisiones aún</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-3">Fecha</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-3">Estado cultivos</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-3">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {reviews.slice(0, 5).map(r => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3 text-sm text-gray-600">{format(new Date(r.createdAt), "dd/MM/yyyy")}</td>
                    <td className="px-5 py-3 text-sm text-gray-900">{r.cropStatus || "-"}</td>
                    <td className="px-5 py-3 text-sm text-gray-600 truncate max-w-xs">{r.generalObservations || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

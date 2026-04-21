import Sidebar from "../components/Sidebar";
import { trpc } from "../lib/trpc";
import { MapPin, Sprout, ClipboardList, CheckSquare, Download } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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

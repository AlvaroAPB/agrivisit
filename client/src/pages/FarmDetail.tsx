import Sidebar from "../components/Sidebar";
import { trpc } from "../lib/trpc";
import { useParams } from "wouter";
import { format } from "date-fns";

export default function FarmDetail() {
  const { id } = useParams<{ id: string }>();
  const farmId = parseInt(id);
  const { data: farm } = trpc.farms.getById.useQuery({ id: farmId });
  const { data: reviews = [], refetch: refetchReviews } = trpc.reviews.listByFarm.useQuery({ farmId });
  const { data: crops = [] } = trpc.crops.listByFarm.useQuery({ farmId });
  const createReview = trpc.reviews.create.useMutation({ onSuccess: () => refetchReviews() });
  const deleteReview = trpc.reviews.delete.useMutation({ onSuccess: () => refetchReviews() });

  const generateReviewPDF = async (review: typeof reviews[0]) => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF();
    doc.setFillColor(21, 128, 61);
    doc.rect(0, 0, 210, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18); doc.setFont("helvetica", "bold");
    doc.text("AgriVisit — Informe de Revisión", 14, 18);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Fecha: ${format(new Date(review.createdAt), "dd/MM/yyyy")}`, 14, 26);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text(farm?.name || "Finca", 14, 45);
    if (farm?.location) { doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(100,100,100); doc.text(farm.location, 14, 52); }
    doc.setTextColor(0,0,0);
    autoTable(doc, {
      startY: 60,
      head: [["Campo", "Valor"]],
      body: [
        ["Estado cultivos", review.cropStatus || "-"],
        ["Infraestructura", review.infrastructure || "-"],
        ["Suministros", review.supplies || "-"],
        ["Observaciones", review.generalObservations || "-"],
        ["Recomendaciones", review.recommendations || "-"],
      ],
      theme: "grid",
      headStyles: { fillColor: [21, 128, 61] },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
    });
    doc.setFontSize(8); doc.setTextColor(150,150,150);
    doc.text("AgriVisit — Sistema de revisión de fincas", 14, 285);
    doc.save(`revision-${farm?.name}-${format(new Date(review.createdAt), "yyyy-MM-dd")}.pdf`);
  };

  if (!farm) return <div className="flex min-h-screen"><Sidebar /><main className="flex-1 flex items-center justify-center"><p className="text-gray-400">Cargando...</p></main></div>;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{farm.name}</h1>
        <p className="text-gray-500 text-sm mb-6">{farm.location} · {farm.totalHectares} ha</p>
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Cultivos ({crops.length})</h2>
            </div>
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
                  <div className="flex gap-2">
                    <button onClick={() => generateReviewPDF(r)} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">PDF</button>
                    <button onClick={() => deleteReview.mutate({ id: r.id })} className="text-xs px-2 py-1 bg-red-50 text-red-500 rounded hover:bg-red-100">✕</button>
                  </div>
                </div>
              ))}
              {reviews.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Sin revisiones</p>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

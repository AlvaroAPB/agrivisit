import Sidebar from "../components/Sidebar";
import ComparativaFincas from "../components/ComparativaFincas";

export default function Comparativa() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Comparativa entre fincas</h1>
        <p className="text-gray-500 text-sm mb-6">Compara datos climáticos entre las fincas seleccionadas — útil para analizar diferencias entre zonas geográficas o validar requerimientos de variedad</p>
        <ComparativaFincas />
      </main>
    </div>
  );
}

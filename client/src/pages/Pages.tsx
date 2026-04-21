import Sidebar from "../components/Sidebar";
import { trpc } from "../lib/trpc";
import { format } from "date-fns";

export function Crops() {
  const { data: farms = [] } = trpc.farms.list.useQuery();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Cultivos</h1>
        <p className="text-gray-500">Selecciona una finca desde el menú para ver sus cultivos.</p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          {farms.map(f => (
            <a key={f.id} href={`/fincas/${f.id}`} className="bg-white rounded-xl border border-gray-100 p-4 hover:border-green-200 transition-colors">
              <p className="font-semibold text-gray-900">{f.name}</p>
              <p className="text-sm text-gray-500">{f.location} · {f.totalHectares} ha</p>
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}

export function Reviews() {
  const { data: reviews = [] } = trpc.reviews.allReviews.useQuery();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Todas las revisiones</h1>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          {reviews.length === 0 ? (
            <p className="text-center text-gray-400 py-12">No hay revisiones registradas</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-3">Fecha</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-3">Estado</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-3">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map(r => (
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

export function Tasks() {
  const { data: farms = [] } = trpc.farms.list.useQuery();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Tareas</h1>
        <p className="text-gray-500">Selecciona una finca para gestionar sus tareas.</p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          {farms.map(f => (
            <a key={f.id} href={`/fincas/${f.id}`} className="bg-white rounded-xl border border-gray-100 p-4 hover:border-green-200 transition-colors">
              <p className="font-semibold text-gray-900">{f.name}</p>
              <p className="text-sm text-gray-500">{f.location}</p>
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-6xl font-bold text-gray-200 mb-4">404</p>
          <p className="text-gray-500">Página no encontrada</p>
          <a href="/dashboard" className="mt-4 inline-block px-4 py-2 bg-green-600 text-white rounded-lg text-sm">Volver al inicio</a>
        </div>
      </main>
    </div>
  );
}

export default NotFound;

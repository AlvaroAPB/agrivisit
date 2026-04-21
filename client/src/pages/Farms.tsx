// Farms.tsx
import Sidebar from "../components/Sidebar";
import { trpc } from "../lib/trpc";
import { useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { Link } from "wouter";

export function Farms() {
  const { data: farms = [], refetch } = trpc.farms.list.useQuery();
  const create = trpc.farms.create.useMutation({ onSuccess: () => { refetch(); setShowForm(false); resetForm(); } });
  const remove = trpc.farms.delete.useMutation({ onSuccess: () => refetch() });
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState(""); const [location, setLocation] = useState(""); const [hectares, setHectares] = useState("");
  const resetForm = () => { setName(""); setLocation(""); setHectares(""); };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Fincas</h1>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
            <Plus className="w-4 h-4" /> Nueva finca
          </button>
        </div>
        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-4">Nueva finca</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Nombre de la finca" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                <input value={location} onChange={e => setLocation(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Municipio, provincia" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Hectáreas</label>
                <input value={hectares} onChange={e => setHectares(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Ej: 12.5" /></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => create.mutate({ name, location, totalHectares: hectares })} disabled={!name || create.isPending} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {create.isPending ? "Guardando..." : "Guardar"}
              </button>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm">Cancelar</button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {farms.map(farm => (
            <div key={farm.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:border-green-200 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-green-600" />
                </div>
                <button onClick={() => remove.mutate({ id: farm.id })} className="text-gray-300 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <Link href={`/fincas/${farm.id}`}>
                <a className="block">
                  <h3 className="font-semibold text-gray-900 hover:text-green-700">{farm.name}</h3>
                  {farm.location && <p className="text-sm text-gray-500 mt-1">{farm.location}</p>}
                  {farm.totalHectares && <p className="text-sm text-gray-500">{farm.totalHectares} ha</p>}
                </a>
              </Link>
            </div>
          ))}
          {farms.length === 0 && <p className="col-span-3 text-center text-gray-400 py-12">No hay fincas registradas</p>}
        </div>
      </main>
    </div>
  );
}

export default Farms;

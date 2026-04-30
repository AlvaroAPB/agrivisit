import { getNutrientNeeds } from "../lib/agronomy";

interface AgroStatsProps {
  crop: string;
  yieldTarget?: number;
  ce?: number;
}

export default function AgroStats({ crop, yieldTarget = 20, ce = 1.2 }: AgroStatsProps) {
  const stats = getNutrientNeeds(crop, { yieldTarget, soilCE: ce });
  const isBerry = ["Arándano", "Frambuesa", "Fresa"].includes(crop);

  return (
    <div className={`mt-4 p-4 rounded-xl border ${isBerry ? 'border-red-100 bg-red-50/50' : 'border-orange-100 bg-orange-50/50'}`}>
      <div className="flex justify-between items-center mb-3">
        <h3 className={`text-[10px] font-black uppercase tracking-widest ${isBerry ? 'text-red-800' : 'text-orange-800'}`}>
          Recomendación Nutricional {isBerry ? 'Berries' : 'Hueso'}
        </h3>
        {stats.isCriticalCE && (
          <span className="text-[9px] bg-red-600 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">
            CE CRÍTICA
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-2 rounded-lg shadow-sm border border-black/5 text-center">
          <p className="text-[9px] text-gray-400 font-bold uppercase">Nitrógeno</p>
          <p className="text-lg font-mono font-black text-blue-700">{stats.n}<span className="text-[10px] ml-0.5">kg</span></p>
        </div>
        <div className="bg-white p-2 rounded-lg shadow-sm border border-black/5 text-center">
          <p className="text-[9px] text-gray-400 font-bold uppercase">Fósforo</p>
          <p className="text-lg font-mono font-black text-green-700">{stats.p}<span className="text-[10px] ml-0.5">kg</span></p>
        </div>
        <div className="bg-white p-2 rounded-lg shadow-sm border border-black/5 text-center">
          <p className="text-[9px] text-gray-400 font-bold uppercase">Potasio</p>
          <p className="text-lg font-mono font-black text-orange-700">{stats.k}<span className="text-[10px] ml-0.5">kg</span></p>
        </div>
      </div>
    </div>
  );
}

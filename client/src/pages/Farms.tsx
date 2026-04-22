import { useState } from "react";
import Sidebar from "../components/Sidebar";
import { trpc } from "../lib/trpc";
import { MapPin, Plus, ChevronRight, ChevronLeft, Save, Loader2, Trash2 } from "lucide-react";
import MapaSatelite from "../components/MapaSatelite";
import { Link } from "wouter";

const CULTIVOS_HUESO = ["Melocotón","Nectarina","Albaricoque","Paraguayo","Pluot","Ciruela","Cereza","Otro hueso"];
const CULTIVOS_BERRIES = ["Arándano","Frambuesa","Fresa","Mora","Grosella","Otro berry"];
const CULTIVOS_OTROS = ["Cítrico","Vid","Olivo","Almendro","Cereales","Otro"];
const ZONAS = [
  { pais:"España", regiones:["Sevilla","Huelva","Extremadura","Córdoba","Murcia","Valencia","Cataluña","Otras"] },
  { pais:"Portugal", regiones:["Alentejo","Ribatejo","Algarve","Otras"] },
  { pais:"Marruecos", regiones:["Souss-Massa","Gharb","Otras"] },
  { pais:"Perú", regiones:["Ica","La Libertad","Piura","Otras"] },
  { pais:"Sudáfrica", regiones:["Western Cape","Northern Cape","Otras"] },
];
const SISTEMAS_RIEGO = ["Goteo","Microaspersión","Aspersión","Gravedad / Inundación","Secano","Mixto"];
const SISTEMAS_CONDUCCION = ["Vaso","Espaldera simple","Espaldera doble","Intensivo","Súper-intensivo","Otro"];
const TIPOS_SUELO = ["Franco","Franco-arcilloso","Arcilloso","Franco-arenoso","Arenoso","Limoso","Otro"];
const ORIGENES_AGUA = ["Pozo propio","Acequia / Canal","Embalse","Red de riego","Mixto"];
const PENDIENTES = ["Llano (0-2%)","Suave (2-5%)","Moderada (5-15%)","Fuerte (>15%)"];
const DESTINOS = ["Exportación Europa","Exportación Asia","Mercado nacional","Industria","Mixto"];
const SECCIONES = ["Identificación","Cultivo","Suelo y agua","Producción","Gestión"];



function F({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}{req && <span className="text-red-400 ml-1">*</span>}</label>
      {children}
    </div>
  );
}
const ic = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";
const sc = ic + " bg-white";

interface FF {
  name:string; pais:string; region:string; municipio:string; refCatastral:string;
  lat:string; lng:string; altitud:string; superficie:string; encargado:string; telEncargado:string;
  especie:string; variedad:string; anyoPlantacion:string; marcoPlantacion:string;
  densidad:string; conduccion:string; portainjerto:string; supCultivo:string; nPlantas:string;
  tipoSuelo:string; ph:string; materiaOrganica:string; conductividad:string;
  sistemaRiego:string; origenAgua:string; dotacionAgua:string; pendiente:string;
  produccionMedia:string; mejorCampanya:string; destino:string;
  ecologico:string; globalGap:string; cooperativa:string;
  manoObra:string; maquinaria:string; observaciones:string;
}
const E:FF = {
  name:"",pais:"España",region:"",municipio:"",refCatastral:"",
  lat:"",lng:"",altitud:"",superficie:"",encargado:"",telEncargado:"",
  especie:"",variedad:"",anyoPlantacion:"",marcoPlantacion:"",
  densidad:"",conduccion:"",portainjerto:"",supCultivo:"",nPlantas:"",
  tipoSuelo:"",ph:"",materiaOrganica:"",conductividad:"",
  sistemaRiego:"",origenAgua:"",dotacionAgua:"",pendiente:"",
  produccionMedia:"",mejorCampanya:"",destino:"",
  ecologico:"No",globalGap:"No",cooperativa:"",
  manoObra:"",maquinaria:"",observaciones:"",
};

function Modal({ onClose, onSaved }: { onClose:()=>void; onSaved:()=>void }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState<FF>(E);
  const create = trpc.farms.create.useMutation({ onSuccess: () => { onSaved(); onClose(); } });
  const set = (k: keyof FF) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => setF(p => ({...p,[k]:e.target.value}));
  const regiones = ZONAS.find(z=>z.pais===f.pais)?.regiones ?? [];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Nueva ficha de finca</h2>
            <p className="text-sm text-gray-500">{step+1} de {SECCIONES.length} — {SECCIONES[step]}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>
        <div className="flex px-5 pt-3 gap-1.5">
          {SECCIONES.map((_,i) => <div key={i} className={`flex-1 h-1.5 rounded-full ${i<=step?"bg-green-500":"bg-gray-100"}`}/>)}
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {step===0 && <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><F label="Nombre de la finca" req><input value={f.name} onChange={set("name")} className={ic} placeholder="Ej: Finca Las Marismas"/></F></div>
            <F label="País" req><select value={f.pais} onChange={e=>setF(p=>({...p,pais:e.target.value,region:""}))} className={sc}>{ZONAS.map(z=><option key={z.pais}>{z.pais}</option>)}</select></F>
            <F label="Región / Provincia" req><select value={f.region} onChange={set("region")} className={sc}><option value="">Selecciona...</option>{regiones.map(r=><option key={r}>{r}</option>)}</select></F>
            <F label="Municipio" req><input value={f.municipio} onChange={set("municipio")} className={ic} placeholder="Ej: La Rinconada"/></F>
            <F label="Referencia catastral"><input value={f.refCatastral} onChange={set("refCatastral")} className={ic} placeholder="Pol. 12 / Parc. 45"/></F>
            <F label="Latitud"><input value={f.lat} onChange={set("lat")} className={ic} placeholder="Ej: 37.4983" type="number" step="0.0001"/></F>
            <F label="Longitud"><input value={f.lng} onChange={set("lng")} className={ic} placeholder="Ej: -5.9808" type="number" step="0.0001"/></F>
            <F label="Altitud (m s.n.m.)"><input value={f.altitud} onChange={set("altitud")} className={ic} placeholder="Ej: 120" type="number"/></F>
            <F label="Superficie total (ha)" req><input value={f.superficie} onChange={set("superficie")} className={ic} placeholder="Ej: 45.5" type="number" step="0.1"/></F>
            <F label="Encargado de campo"><input value={f.encargado} onChange={set("encargado")} className={ic} placeholder="Nombre"/></F>
            <F label="Teléfono encargado"><input value={f.telEncargado} onChange={set("telEncargado")} className={ic} placeholder="+34 600 000 000"/></F>
            <MapaSatelite lat={f.lat} lng={f.lng} onSelect={(la,lo)=>setF(p=>({...p,lat:String(la),lng:String(lo)}))} />
          </div>}

          {step===1 && <div className="grid grid-cols-2 gap-4">
            <F label="Especie" req><select value={f.especie} onChange={set("especie")} className={sc}><option value="">Selecciona...</option><optgroup label="Fruta de hueso">{CULTIVOS_HUESO.map(c=><option key={c}>{c}</option>)}</optgroup><optgroup label="Berries">{CULTIVOS_BERRIES.map(c=><option key={c}>{c}</option>)}</optgroup><optgroup label="Otros">{CULTIVOS_OTROS.map(c=><option key={c}>{c}</option>)}</optgroup></select></F>
            <F label="Variedad" req><input value={f.variedad} onChange={set("variedad")} className={ic} placeholder="Ej: Blu Aroma, Glamour..."/></F>
            <F label="Año de plantación" req><input value={f.anyoPlantacion} onChange={set("anyoPlantacion")} className={ic} placeholder="Ej: 2018" type="number" min="1950" max="2030"/></F>
            <F label="Sistema de conducción"><select value={f.conduccion} onChange={set("conduccion")} className={sc}><option value="">Selecciona...</option>{SISTEMAS_CONDUCCION.map(s=><option key={s}>{s}</option>)}</select></F>
            <F label="Marco de plantación"><input value={f.marcoPlantacion} onChange={set("marcoPlantacion")} className={ic} placeholder="Ej: 4x1.5 m"/></F>
            <F label="Densidad (plantas/ha)"><input value={f.densidad} onChange={set("densidad")} className={ic} placeholder="Ej: 2500" type="number"/></F>
            <F label="Portainjerto"><input value={f.portainjerto} onChange={set("portainjerto")} className={ic} placeholder="Ej: GF677"/></F>
            <F label="Superficie cultivo (ha)"><input value={f.supCultivo} onChange={set("supCultivo")} className={ic} placeholder="Ej: 38" type="number" step="0.1"/></F>
            <F label="Nº plantas / árboles"><input value={f.nPlantas} onChange={set("nPlantas")} className={ic} placeholder="Ej: 95000" type="number"/></F>
          </div>}

          {step===2 && <div className="grid grid-cols-2 gap-4">
            <F label="Tipo de suelo"><select value={f.tipoSuelo} onChange={set("tipoSuelo")} className={sc}><option value="">Selecciona...</option>{TIPOS_SUELO.map(s=><option key={s}>{s}</option>)}</select></F>
            <F label="Pendiente media"><select value={f.pendiente} onChange={set("pendiente")} className={sc}><option value="">Selecciona...</option>{PENDIENTES.map(p=><option key={p}>{p}</option>)}</select></F>
            <F label="pH del suelo"><input value={f.ph} onChange={set("ph")} className={ic} placeholder="Ej: 7.2" type="number" step="0.1" min="3" max="10"/></F>
            <F label="Materia orgánica (%)"><input value={f.materiaOrganica} onChange={set("materiaOrganica")} className={ic} placeholder="Ej: 1.8" type="number" step="0.1"/></F>
            <F label="Conductividad eléctrica (dS/m)"><input value={f.conductividad} onChange={set("conductividad")} className={ic} placeholder="Ej: 0.4" type="number" step="0.1"/></F>
            <F label="Sistema de riego" req><select value={f.sistemaRiego} onChange={set("sistemaRiego")} className={sc}><option value="">Selecciona...</option>{SISTEMAS_RIEGO.map(s=><option key={s}>{s}</option>)}</select></F>
            <F label="Origen del agua"><select value={f.origenAgua} onChange={set("origenAgua")} className={sc}><option value="">Selecciona...</option>{ORIGENES_AGUA.map(o=><option key={o}>{o}</option>)}</select></F>
            <F label="Dotación agua (m³/ha/año)"><input value={f.dotacionAgua} onChange={set("dotacionAgua")} className={ic} placeholder="Ej: 4500" type="number"/></F>
          </div>}

          {step===3 && <div className="grid grid-cols-2 gap-4">
            <F label="Producción media (kg/ha)"><input value={f.produccionMedia} onChange={set("produccionMedia")} className={ic} placeholder="Ej: 8500" type="number"/></F>
            <F label="Mejor campaña (año)"><input value={f.mejorCampanya} onChange={set("mejorCampanya")} className={ic} placeholder="Ej: 2022" type="number"/></F>
            <F label="Destino producción"><select value={f.destino} onChange={set("destino")} className={sc}><option value="">Selecciona...</option>{DESTINOS.map(d=><option key={d}>{d}</option>)}</select></F>
            <F label="Mano de obra"><select value={f.manoObra} onChange={set("manoObra")} className={sc}><option value="">Selecciona...</option>{["Propia","Contratada","Mixta"].map(m=><option key={m}>{m}</option>)}</select></F>
            <F label="Certificación ecológica"><select value={f.ecologico} onChange={set("ecologico")} className={sc}><option>No</option><option>En conversión</option><option>Sí — certificado</option></select></F>
            <F label="GlobalGAP / IFS"><select value={f.globalGap} onChange={set("globalGap")} className={sc}><option>No</option><option>Sí</option><option>En proceso</option></select></F>
            <div className="col-span-2"><F label="Cooperativa / Central compradora"><input value={f.cooperativa} onChange={set("cooperativa")} className={ic} placeholder="Nombre de la central o cooperativa"/></F></div>
          </div>}

          {step===4 && <div className="grid grid-cols-1 gap-4">
            <F label="Maquinaria propia"><input value={f.maquinaria} onChange={set("maquinaria")} className={ic} placeholder="Ej: Tractor, atomizador, plataforma..."/></F>
            <F label="Observaciones generales"><textarea value={f.observaciones} onChange={set("observaciones")} className={`${ic} resize-none`} rows={6} placeholder="Estado general, incidencias, notas técnicas..."/></F>
            {create.error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{create.error.message}</p>}
          </div>}
        </div>

        <div className="p-4 border-t border-gray-100 flex items-center justify-between">
          <button onClick={()=>setStep(s=>s-1)} disabled={step===0} className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">
            <ChevronLeft className="w-4 h-4"/> Anterior
          </button>
          <span className="text-xs text-gray-400">{step+1} / {SECCIONES.length}</span>
          {step<SECCIONES.length-1
            ? <button onClick={()=>setStep(s=>s+1)} disabled={step===0&&!f.name} className="flex items-center gap-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40">Siguiente <ChevronRight className="w-4 h-4"/></button>
            : <button onClick={()=>create.mutate({name:f.name,location:`${f.municipio}, ${f.region}, ${f.pais}`,totalHectares:f.superficie,latitude:f.lat?parseFloat(f.lat):undefined,longitude:f.lng?parseFloat(f.lng):undefined,description:JSON.stringify(f)})} disabled={create.isPending||!f.name} className="flex items-center gap-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              {create.isPending?<><Loader2 className="w-4 h-4 animate-spin"/>Guardando...</>:<><Save className="w-4 h-4"/>Guardar ficha</>}
            </button>
          }
        </div>
      </div>
    </div>
  );
}

export function Farms() {
  const { data: farms=[], refetch } = trpc.farms.list.useQuery();
  const remove = trpc.farms.delete.useMutation({ onSuccess:()=>refetch() });
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar/>
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fincas</h1>
            <p className="text-sm text-gray-500 mt-1">{farms.length} finca{farms.length!==1?"s":""} registrada{farms.length!==1?"s":""}</p>
          </div>
          <button onClick={()=>setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
            <Plus className="w-4 h-4"/> Nueva ficha de finca
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {farms.map(farm => {
            let ex: any = {};
            try { ex = JSON.parse(farm.description||"{}"); } catch {}
            return (
              <div key={farm.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:border-green-200 transition-colors overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-green-600"/>
                    </div>
                    <button onClick={()=>remove.mutate({id:farm.id})} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                  </div>
                  <Link href={`/fincas/${farm.id}`}>
                    <a className="block">
                      <h3 className="font-semibold text-gray-900 hover:text-green-700 mb-1">{farm.name}</h3>
                      {farm.location && <p className="text-sm text-gray-500 mb-2">{farm.location}</p>}
                      <div className="flex flex-wrap gap-1.5">
                        {ex.especie && <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full">{ex.especie}</span>}
                        {ex.variedad && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{ex.variedad}</span>}
                        {farm.totalHectares && <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{farm.totalHectares} ha</span>}
                        {ex.sistemaRiego && <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full">{ex.sistemaRiego}</span>}
                      </div>
                    </a>
                  </Link>
                </div>
                {ex.lat && ex.lng && !isNaN(parseFloat(ex.lat)) && (
                  <a href={`https://www.google.com/maps/@${ex.lat},${ex.lng},200m/data=!3m1!1e3`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 px-4 py-2 border-t border-gray-100 text-xs text-gray-500 hover:bg-gray-50 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#16a34a"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                    {parseFloat(ex.lat).toFixed(4)}, {parseFloat(ex.lng).toFixed(4)} — Ver satélite
                  </a>
                )}
              </div>
            );
          })}
          {farms.length===0 && (
            <div className="col-span-3 text-center py-16">
              <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-3"/>
              <p className="text-gray-400 mb-4">No hay fincas registradas</p>
              <button onClick={()=>setShowModal(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Crear primera ficha</button>
            </div>
          )}
        </div>
      </main>
      {showModal && <Modal onClose={()=>setShowModal(false)} onSaved={()=>refetch()}/>}
    </div>
  );
}

export default Farms;

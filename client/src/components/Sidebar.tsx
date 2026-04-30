import { Link, useLocation } from "wouter";
import { Leaf, LogOut } from "lucide-react";
import { trpc } from "../lib/trpc";

const nav = [
  { section: null, href: "/dashboard", label: "Dashboard" },
  { section: "Gestión", href: "/inventario", label: "Inventario global" },
  { section: null, href: "/fincas", label: "Fincas" },
  { section: null, href: "/cultivos", label: "Cultivos y variedades" },
  { section: "Técnico", href: "/campanyas", label: "Campañas" },
  { section: null, href: "/comparativa", label: "Clima comparativo" },
  { section: null, href: "/fertirriego", label: "Fertirrigación" },
  { section: null, href: "/prediccion", label: "Predicción de cosecha" },
  { section: "Campo", href: "/visitas", label: "Visitas de campo" },
  { section: null, href: "/revisiones", label: "Revisiones" },
  { section: null, href: "/tareas", label: "Tareas" },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { data: user } = trpc.auth.me.useQuery();
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/"; }
  });

  let lastSection: string | null = undefined as any;

  return (
    <aside className="w-56 bg-green-900 text-white flex flex-col min-h-screen">
      <div className="p-5 border-b border-green-800">
        <div className="flex items-center gap-2">
          <Leaf className="w-6 h-6 text-green-300" />
          <span className="font-bold text-lg">AgriVisit</span>
        </div>
      </div>
      <nav className="flex-1 p-3 pt-2">
        {nav.map(({ section, href, label }) => {
          const isActive = location === href || location.startsWith(href + "/");
          const showSection = section && section !== lastSection;
          if (section) lastSection = section;

          return (
            <div key={href}>
              {showSection && (
                <p className="text-xs font-semibold text-green-500 uppercase tracking-wider px-3 pt-4 pb-1">
                  {section}
                </p>
              )}
              <Link href={href}>
                <a className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
                  isActive
                    ? "bg-green-600 text-white shadow-inner"
                    : "text-green-200 hover:bg-green-800 hover:text-white"
                }`}>
                  {label}
                </a>
              </Link>
            </div>
          );
        })}
      </nav>
      <div className="p-3 border-t border-green-800">
        <div className="px-3 py-2 mb-2">
          <p className="text-sm font-medium text-white">{user?.name}</p>
          <p className="text-xs text-green-400">{user?.role}</p>
        </div>
        <button
          onClick={() => logout.mutate()}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-green-200 hover:bg-green-800 hover:text-white transition-colors w-full"
        >
          <LogOut className="w-4 h-4" /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

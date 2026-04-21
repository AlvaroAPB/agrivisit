import { Link, useLocation } from "wouter";
import { LayoutDashboard, MapPin, Sprout, ClipboardList, CheckSquare, LogOut, Leaf } from "lucide-react";
import { trpc } from "../lib/trpc";

const nav = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/fincas", icon: MapPin, label: "Fincas" },
  { href: "/cultivos", icon: Sprout, label: "Cultivos" },
  { href: "/revisiones", icon: ClipboardList, label: "Revisiones" },
  { href: "/tareas", icon: CheckSquare, label: "Tareas" },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { data: user } = trpc.auth.me.useQuery();
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/"; }
  });

  return (
    <aside className="w-56 bg-green-900 text-white flex flex-col min-h-screen">
      <div className="p-5 border-b border-green-800">
        <div className="flex items-center gap-2">
          <Leaf className="w-6 h-6 text-green-300" />
          <span className="font-bold text-lg">AgriVisit</span>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {nav.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href}>
            <a className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${location === href ? "bg-green-700 text-white" : "text-green-200 hover:bg-green-800 hover:text-white"}`}>
              <Icon className="w-4 h-4" />
              {label}
            </a>
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-green-800">
        <div className="px-3 py-2 mb-2">
          <p className="text-sm font-medium text-white">{user?.name}</p>
          <p className="text-xs text-green-400">{user?.role}</p>
        </div>
        <button onClick={() => logout.mutate()} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-green-200 hover:bg-green-800 hover:text-white transition-colors w-full">
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

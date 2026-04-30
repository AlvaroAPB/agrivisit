import { Switch, Route, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient } from "./lib/trpc";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Farms from "./pages/Farms";
import FarmDetail from "./pages/FarmDetail";
import Crops from "./pages/Crops";
import Reviews from "./pages/Reviews";
import Tasks from "./pages/Tasks";
import Comparativa from "./pages/Comparativa";
import Campaigns from "./pages/Campaigns";
import ModelAnalysis from "./pages/ModelAnalysis";
import Cultivos from "./pages/Cultivos";
import Fertirrigation from "./pages/Fertirrigation";
import Inventario from "./pages/Inventario";
import Visitas from "./pages/Visitas";
import Prediccion from "./pages/Prediccion";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } }
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = trpc.auth.me.useQuery();
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-green-50">
      <div className="animate-spin w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full" />
    </div>
  );
  if (!user) return <Redirect to="/" />;
  return <>{children}</>;
}

export default function App() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Switch>
          <Route path="/" component={Login} />
          <Route path="/dashboard">
            <AuthGuard><Dashboard /></AuthGuard>
          </Route>
          <Route path="/fincas">
            <AuthGuard><Farms /></AuthGuard>
          </Route>
          <Route path="/fincas/:id">
            <AuthGuard><FarmDetail /></AuthGuard>
          </Route>
          <Route path="/comparativa">
            <AuthGuard><Comparativa /></AuthGuard>
          </Route>
          <Route path="/campanyas">
            <AuthGuard><Campaigns /></AuthGuard>
          </Route>
          <Route path="/analisis">
            <AuthGuard><ModelAnalysis /></AuthGuard>
          </Route>
          <Route path="/cultivos">
            <AuthGuard><Cultivos /></AuthGuard>
          </Route>
          <Route path="/fertirriego">
            <AuthGuard><Fertirrigation /></AuthGuard>
          </Route>
          <Route path="/inventario">
            <AuthGuard><Inventario /></AuthGuard>
          </Route>
          <Route path="/visitas/:id">
            <AuthGuard><Visitas /></AuthGuard>
          </Route>
          <Route path="/visitas">
            <AuthGuard><Visitas /></AuthGuard>
          </Route>
          <Route path="/prediccion">
            <AuthGuard><Prediccion /></AuthGuard>
          </Route>
          <Route path="/cultivos">
            <AuthGuard><Crops /></AuthGuard>
          </Route>
          <Route path="/revisiones">
            <AuthGuard><Reviews /></AuthGuard>
          </Route>
          <Route path="/tareas">
            <AuthGuard><Tasks /></AuthGuard>
          </Route>
          <Route component={NotFound} />
        </Switch>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

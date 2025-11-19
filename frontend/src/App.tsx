import * as React from "react"; 
import { Switch, Route, Redirect } from "wouter"; 
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import ThemeToggle from "@/components/ThemeToggle";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Appointments from "@/pages/Appointments";
import Customers from "@/pages/Customers";
import Staff from "@/pages/Staff";
import Services from "@/pages/Services";
import Locations from "@/pages/Locations";
import Payments from "@/pages/Payments";
import Reports from "@/pages/Reports";
import NotFound from "@/pages/not-found";
import Profile from "./pages/Profile";
import Management from "./pages/Management";
// 💡 IMPORTAÇÃO DA PÁGINA PÚBLICA
import AgendamentoCliente from "@/pages/AgendamentoCliente"; 

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('access_token') || sessionStorage.getItem('accessToken');
  if (!token) {
    return <Redirect to="/login" />;
  }
  return <>{children}</>;
}

function MainLayout() {
  const style = { "--sidebar-width": "16rem" };
  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b bg-background sticky top-0 z-10">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto bg-background">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/appointments" component={Appointments} />
              <Route path="/customers" component={Customers} />
              <Route path="/staff" component={Staff} />
              <Route path="/services" component={Services} />
              <Route path="/locations" component={Locations} />
              <Route path="/payments" component={Payments} />
              <Route path="/reports" component={Reports} />
              <Route path="/profile" component={Profile} />
              <Route path="/management" component={Management} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Switch>
          {/* ROTAS PÚBLICAS (Não exigem login) */}
          <Route path="/login" component={Login} />
          <Route path="/agendar" component={AgendamentoCliente} /> {/* 💡 NOVA ROTA PÚBLICA */}

          {/* ROTAS PRIVADAS (Painel Administrativo) */}
          <Route>
            <PrivateRoute>
              <MainLayout />
            </PrivateRoute>
          </Route>
        </Switch>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
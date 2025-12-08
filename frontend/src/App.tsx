import * as React from "react"; 
import { Switch, Route, Redirect } from "wouter"; 
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import ThemeToggle from "@/components/ThemeToggle";

// --- PÁGINAS ---
import Login from "@/pages/Login";
import AgendamentoCliente from "@/pages/AgendamentoCliente"; // Página Pública
import NotFound from "@/pages/not-found";

// Páginas Administrativas
import Dashboard from "@/pages/Dashboard";
import Appointments from "@/pages/Appointments";
import Customers from "@/pages/Customers";
import Staff from "@/pages/Staff";
import Services from "@/pages/Services";
import Locations from "@/pages/Locations";
import Payments from "@/pages/Payments";
import Reports from "@/pages/Reports";
import Profile from "@/pages/Profile";
import Management from "@/pages/Management";
import Promotions from "@/pages/Promotions";

// 🔒 COMPONENTE DE PROTEÇÃO (Verifica Login)
function PrivateRoute({ children }: { children: React.ReactNode }) {
  // Verifica token no localStorage ou sessionStorage
  const token = localStorage.getItem('access_token') || sessionStorage.getItem('accessToken');
  
  if (!token) {
    // Se não tiver token, manda pro login
    return <Redirect to="/login" />;
  }

  // Se tiver token, renderiza o conteúdo (MainLayout)
  return <>{children}</>;
}

// 🏠 LAYOUT DO PAINEL DE GESTÃO (Com Sidebar)
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
            {/* ROTEADOR INTERNO (Só roda se estiver logado) */}
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/appointments" component={Appointments} />
              <Route path="/customers" component={Customers} />
              <Route path="/staff" component={Staff} />
              <Route path="/services" component={Services} />
              <Route path="/locations" component={Locations} />
              <Route path="/payments" component={Payments} />
              <Route path="/reports" component={Reports} />
              <Route path="/profile" component={Profile} />
              <Route path="/management" component={Management} />
              <Route path="/promotions" component={Promotions} />
              
              {/* Se tentar acessar uma rota interna que não existe, cai aqui */}
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

// 🚀 APLICAÇÃO PRINCIPAL
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {/* ROTEADOR PRINCIPAL */}
        <Switch>
          
          {/* 1️⃣ ROTAS PÚBLICAS (Acesso Livre - SEM Layout Admin) */}
          {/* Colocamos estas PRIMEIRO para o roteador achar elas antes de bloquear */}
          <Route path="/agendamento-online" component={AgendamentoCliente} />
          <Route path="/login" component={Login} />

          {/* 2️⃣ ROTAS PROTEGIDAS (Qualquer outra coisa cai aqui) */}
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
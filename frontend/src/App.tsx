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
import AgendamentoCliente from "@/pages/AgendamentoCliente"; // Sua página linda bege
import NotFound from "@/pages/not-found";

// Páginas Administrativas (Gestão)
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
  // Verifica se existe o token salvo
  const token = localStorage.getItem('access_token') || sessionStorage.getItem('accessToken');
  
  if (!token) {
    // Se não tiver token, chuta para o login
    return <Redirect to="/login" />;
  }

  // Se tiver token, deixa entrar
  return <>{children}</>;
}

// 🏠 LAYOUT DO PAINEL DE GESTÃO (Com a Sidebar lateral)
function MainLayout() {
  const style = { "--sidebar-width": "16rem" };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full bg-[#F4F4F5] dark:bg-zinc-950">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Cabeçalho do Admin */}
          <header className="flex items-center justify-between p-4 border-b bg-background sticky top-0 z-10 h-16 shadow-sm">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="font-semibold text-stone-700 dark:text-stone-200">
               Painel de Gestão
            </div>
            <ThemeToggle />
          </header>
          
          {/* Conteúdo das Páginas de Gestão */}
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Switch>
              {/* Se acessar raiz logado, vai pro dashboard */}
              <Route path="/" component={Dashboard} />
              <Route path="/dashboard" component={Dashboard} />
              
              {/* Rotas do Sistema */}
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
        <Switch>
          
          {/* 1️⃣ ÁREA PÚBLICA (CLIENTE) */}
          {/* A rota raiz "/" carrega o Agendamento Cliente (sem sidebar, sem login) */}
          <Route path="/" component={AgendamentoCliente} />
          
          {/* Tela de Login */}
          <Route path="/login" component={Login} />

          {/* 2️⃣ ÁREA PRIVADA (ADMIN) */}
          {/* Qualquer outra rota que não seja as de cima, tentará entrar no painel */}
          {/* O PrivateRoute vai barrar se não tiver login */}
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
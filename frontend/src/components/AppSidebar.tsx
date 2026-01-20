import { 
  Home, 
  Calendar, 
  Users, 
  UserCog, 
  Scissors, 
  MapPin, 
  DollarSign, 
  BarChart3, 
  UserCircle, 
  ShieldCheck, 
  Percent,
  LogOut,
  Package // <--- Importei o ícone Package
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader
} from "@/components/ui/sidebar";
import { useLocation } from "wouter";
import { LogoutButton } from "./LogoutButton"; 

// Agrupando os itens para ficar mais organizado
const mainMenuItems = [
  { title: "Visão Geral", url: "/dashboard", icon: Home },
  { title: "Agenda", url: "/appointments", icon: Calendar },
  { title: "Gestão de Pacotes", url: "/packages", icon: Package }, // <--- NOVO ITEM
  { title: "Clientes", url: "/customers", icon: Users },
];

const registerItems = [
  { title: "Profissionais", url: "/staff", icon: UserCog },
  { title: "Serviços", url: "/services", icon: Scissors },
  { title: "Promoções", url: "/promotions", icon: Percent },
  { title: "Unidades", url: "/locations", icon: MapPin },
];

const financialItems = [
  { title: "Financeiro", url: "/payments", icon: DollarSign },
  { title: "Relatórios", url: "/reports", icon: BarChart3 },
];

export function AppSidebar() {
  const [location] = useLocation();

  // Função auxiliar para renderizar o botão com o estilo "Ativo" dourado
  const renderMenuItem = (item: any) => {
    const isActive = location === item.url;
    
    return (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton 
          asChild 
          className={`
            h-10 transition-all duration-200 
            ${isActive 
              ? "bg-[#C6A87C]/10 text-[#C6A87C] font-semibold border-r-4 border-[#C6A87C]" 
              : "text-stone-500 hover:text-[#C6A87C] hover:bg-stone-50"
            }
          `}
        >
          <a href={item.url} className="flex items-center gap-3 px-3">
            <item.icon className={`w-4 h-4 ${isActive ? "text-[#C6A87C]" : "text-stone-400"}`} />
            <span>{item.title}</span>
          </a>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar className="bg-white border-r border-stone-100">
      
      {/* 🖼️ CABEÇALHO COM LOGO */}
      <SidebarHeader className="h-24 flex items-center justify-center border-b border-stone-50 py-4 mb-2">
        <div className="w-32 h-auto flex justify-center items-center">
            <img 
              src="/img/logo.png" 
              alt="Logo" 
              className="object-contain max-h-16 w-auto"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = '<span class="text-xl font-serif text-[#C6A87C] font-bold">Cheias de Charme</span>';
              }}
            />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        
        {/* GRUPO 1: PRINCIPAL */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-widest text-stone-400 font-medium mt-2 mb-1">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map(renderMenuItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* GRUPO 2: CADASTROS */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-widest text-stone-400 font-medium mt-4 mb-1">
            Cadastros
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {registerItems.map(renderMenuItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* GRUPO 3: GESTÃO */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-widest text-stone-400 font-medium mt-4 mb-1">
            Gestão
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {financialItems.map(renderMenuItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      {/* RODAPÉ: CONFIGURAÇÕES E SAIR */}
      <SidebarFooter className="border-t border-stone-50 p-4">
        <SidebarMenu>
            
            <SidebarMenuItem>
              <SidebarMenuButton asChild className={location === '/management' ? "bg-[#C6A87C]/10 text-[#C6A87C]" : "text-stone-500 hover:text-[#C6A87C]"}>
                  <a href="/management" className="flex items-center gap-3">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Configurações</span>
                  </a>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton asChild className={location === '/profile' ? "bg-[#C6A87C]/10 text-[#C6A87C]" : "text-stone-500 hover:text-[#C6A87C]"}>
                  <a href="/profile" className="flex items-center gap-3">
                      <UserCircle className="w-4 h-4" />
                      <span>Minha Conta</span>
                  </a>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem className="mt-2 pt-2 border-t border-stone-100">
               <LogoutButton />
            </SidebarMenuItem>

        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
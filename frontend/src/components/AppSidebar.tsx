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
  ShieldCheck 
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
} from "@/components/ui/sidebar";
import { useLocation } from "wouter";
import { LogoutButton } from "./LogoutButton"; // Garanta que este arquivo exista em src/components/

const menuItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Agenda", url: "/appointments", icon: Calendar },
  { title: "Clientes", url: "/customers", icon: Users },
  { title: "Profissionais", url: "/staff", icon: UserCog },
  { title: "Serviços", url: "/services", icon: Scissors },
  { title: "Unidades", url: "/locations", icon: MapPin },
  { title: "Financeiro", url: "/payments", icon: DollarSign },
  { title: "Relatórios", url: "/reports", icon: BarChart3 },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      {/* Usamos flexbox para posicionar o menu do usuário no final */}
      <SidebarContent className="flex flex-col h-full p-2">
        
        {/* Grupo de menus principal que ocupa o espaço disponível */}
        <div className="flex-grow">
          <SidebarGroup>
            <SidebarGroupLabel className="text-base font-semibold mb-2 px-2">
              Gestão - Cheias de Charme
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={location === item.url}
                      data-testid={`link-${item.title.toLowerCase()}`}
                    >
                      <a href={item.url}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>

        {/* Grupo de ações do usuário posicionado no final */}
        <div className="mt-auto">
          <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                    asChild 
                    isActive={location === '/management'}
                    data-testid="link-management"
                >
                    <a href="/management">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Gestão</span>
                    </a>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton 
                    asChild 
                    isActive={location === '/profile'}
                    data-testid="link-profile"
                >
                    <a href="/profile">
                        <UserCircle className="w-4 h-4" />
                        <span>Minha Conta</span>
                    </a>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <LogoutButton />
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
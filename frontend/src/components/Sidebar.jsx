import { Home, Calendar, Users, UserCog, Scissors, MapPin, DollarSign, BarChart3, LogOut } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ThemeToggle from "./ThemeToggle";

const menuItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Agenda", url: "/appointments", icon: Calendar },
  { title: "Clientes", url: "/customers", icon: Users },
  { title: "Colaboradores", url: "/staff", icon: UserCog },
  { title: "Serviços", url: "/services", icon: Scissors },
  { title: "Unidades", url: "/locations", icon: MapPin },
  { title: "Financeiro", url: "/payments", icon: DollarSign },
  { title: "Relatórios", url: "/reports", icon: BarChart3 },
];

export default function Sidebar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  };

  return (
    <div className="w-64 min-h-screen bg-white border-r border-beige-dark flex flex-col">
      <div className="p-6 border-b border-beige-dark">
        <h1 className="text-2xl font-bold text-gold-dark">Salão Beleza</h1>
        <p className="text-sm text-gray-500">Sistema de Gestão</p>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.url}>
                <NavLink
                  to={item.url}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? "bg-gold-dark text-white"
                        : "text-gray-700 hover:bg-beige-light"
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.title}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-beige-dark flex items-center justify-between">
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={handleLogout}>
          <LogOut className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}

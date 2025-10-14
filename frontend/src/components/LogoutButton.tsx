// src/components/LogoutButton.tsx

import { useLocation } from "wouter";
import { authAPI } from "@/services/api";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    // 1. Chama a função da API para limpar os tokens do localStorage
    authAPI.logout();
    
    // 2. Redireciona o usuário para a página de login
    // Usamos window.location.href para forçar um recarregamento completo,
    // garantindo que todos os estados da aplicação sejam limpos.
    window.location.href = "/login";
  };

  return (
    <Button 
        variant="ghost" 
        className="w-full justify-start text-muted-foreground hover:text-destructive transition-colors"
        onClick={handleLogout}
        data-testid="logout-button"
    >
        <LogOut className="w-4 h-4 mr-2" />
        Sair da Conta
    </Button>
  );
}
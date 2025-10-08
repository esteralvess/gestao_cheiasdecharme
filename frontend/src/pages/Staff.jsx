import { useState, useEffect } from "react";
import { staffAPI } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Plus, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const response = await staffAPI.getAll();
      setStaff(response.data);
    } catch (error) {
      console.error("Erro ao carregar colaboradores:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gold-dark">Colaboradores</h1>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Novo Colaborador
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <p className="text-gray-500">Carregando...</p>
        ) : staff.length > 0 ? (
          staff.map((member) => (
            <Card key={member.id}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gold-light text-gold-dark flex items-center justify-center font-bold text-lg">
                    {member.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gold-dark">{member.name}</h3>
                    <p className="text-sm text-gray-600">{member.role || "Colaborador"}</p>
                  </div>
                  <Badge className={member.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                    {member.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-gray-500">Nenhum colaborador cadastrado</p>
        )}
      </div>
    </div>
  );
}

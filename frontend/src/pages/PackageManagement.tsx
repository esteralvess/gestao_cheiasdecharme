import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter"; // <--- Import para navegação
import { 
  Package, 
  Calendar, 
  ArrowRight,
  CalendarDays,
  Search,
  CheckCircle2,
  Clock,
  ExternalLink
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { appointmentsAPI } from "@/services/api";
import { format, parseISO, isAfter, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

// --- TIPOS ---
interface PackageGroup {
  id: string;
  customerName: string;
  packageName: string;
  totalSessions: number;
  completedSessions: number;
  sessions: any[];
  nextSessionDate?: Date;
  estimatedCompletion?: Date;
  status: 'active' | 'completed';
  progress: number;
}

export default function PackageManagement() {
  const [, navigate] = useLocation(); // Hook de navegação
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<PackageGroup | null>(null);

  const { data: appointments = [], isLoading } = useQuery({ 
    queryKey: ['appointments'], 
    queryFn: appointmentsAPI.getAll 
  });

  // --- PROCESSAMENTO (Mantido igual) ---
  const packages = useMemo(() => {
    const groups: Record<string, PackageGroup> = {};

    appointments.forEach((app: any) => {
      const notes = app.notes || "";
      if (!notes.includes("[Pacote:")) return;

      const match = notes.match(/\[Pacote:\s*(.*?)\s*-\s*Sessão\s*(\d+)\/(\d+)/);
      
      if (match) {
        const packageName = match[1];
        const totalSessions = parseInt(match[3]);
        const customerId = typeof app.customer === 'object' ? app.customer.id : app.customer;
        const customerName = typeof app.customer === 'object' ? app.customer.full_name : app.customer_name;
        
        const groupKey = `${customerId}-${packageName}`;

        if (!groups[groupKey]) {
          groups[groupKey] = {
            id: groupKey,
            customerName: customerName || "Cliente",
            packageName: packageName,
            totalSessions: totalSessions,
            completedSessions: 0,
            sessions: [],
            status: 'active',
            progress: 0
          };
        }

        let sessionDate = new Date();
        try { sessionDate = parseISO(app.start_time); } catch (e) {}

        groups[groupKey].sessions.push({
          ...app,
          parsedDate: sessionDate,
          sessionNumber: parseInt(match[2])
        });
      }
    });

    return Object.values(groups).map(group => {
      group.sessions.sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());
      group.completedSessions = group.sessions.filter(s => s.status === 'completed').length;
      
      const next = group.sessions.find(s => 
        (s.status === 'confirmed' || s.status === 'pending') && 
        isAfter(s.parsedDate, startOfDay(new Date()))
      );
      group.nextSessionDate = next ? next.parsedDate : undefined;

      const last = group.sessions[group.sessions.length - 1];
      group.estimatedCompletion = last ? last.parsedDate : undefined;

      group.progress = Math.min(100, Math.round((group.completedSessions / group.totalSessions) * 100));

      if (group.completedSessions >= group.totalSessions) {
        group.status = 'completed';
      }

      return group;
    }).sort((a, b) => {
        if (a.status === 'active' && b.status === 'completed') return -1;
        if (a.status === 'completed' && b.status === 'active') return 1;
        if (a.nextSessionDate && b.nextSessionDate) return a.nextSessionDate.getTime() - b.nextSessionDate.getTime();
        return 0;
    });

  }, [appointments]);

  const filteredPackages = useMemo(() => {
    return packages.filter(p => 
      p.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.packageName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [packages, searchTerm]);

  // Função para ir para a agenda
  const handleGoToAppointment = (date: Date) => {
      const dateString = format(date, 'yyyy-MM-dd');
      navigate(`/appointments?date=${dateString}`);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in bg-stone-50/50 dark:bg-stone-950 min-h-screen font-sans pb-20">
      
      {/* HEADER RESPONSIVO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-stone-900 rounded-lg shadow-sm border border-stone-100 dark:border-stone-800">
               <Package className="w-5 h-5 text-[#C6A87C]" />
            </div>
            Gestão de Pacotes
          </h1>
          <p className="text-stone-500 text-sm mt-1 ml-1">
            Acompanhe o progresso e agendamentos.
          </p>
        </div>
        
        <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <Input 
                placeholder="Buscar cliente ou pacote..." 
                className="pl-9 bg-white border-stone-200 focus:border-[#C6A87C] focus:ring-0 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      {/* LISTAGEM DE PACOTES */}
      {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
             <div className="w-8 h-8 border-4 border-[#C6A87C]/30 border-t-[#C6A87C] rounded-full animate-spin"></div>
             <p className="text-stone-400 text-sm">Carregando pacotes...</p>
          </div>
      ) : filteredPackages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-stone-200 rounded-2xl bg-white text-stone-400">
              <Package className="w-10 h-10 opacity-50 mb-3" />
              <p className="font-medium">Nenhum pacote encontrado.</p>
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPackages.map((pkg) => (
                  <Card key={pkg.id} className="group hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-stone-100 bg-white overflow-hidden cursor-pointer" onClick={() => setSelectedPackage(pkg)}>
                      <div className={`h-1.5 w-full ${pkg.status === 'completed' ? 'bg-emerald-500' : 'bg-[#C6A87C]'}`} />
                      
                      <CardHeader className="pb-3 pt-4 px-5 flex flex-row justify-between items-start space-y-0">
                          <div className="flex gap-3 items-center w-full overflow-hidden">
                              <div className="h-10 w-10 shrink-0 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 font-bold border border-stone-200">
                                  {pkg.customerName.charAt(0).toUpperCase()}
                              </div>
                              <div className="overflow-hidden w-full">
                                  <CardTitle className="text-sm font-bold text-stone-800 truncate pr-2">{pkg.customerName}</CardTitle>
                                  <p className="text-xs text-stone-500 truncate" title={pkg.packageName}>{pkg.packageName}</p>
                              </div>
                          </div>
                          {pkg.status === 'completed' ? (
                              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200 shrink-0">Concluído</Badge>
                          ) : (
                              <Badge variant="outline" className="text-stone-500 bg-stone-50 border-stone-200 shrink-0 whitespace-nowrap">Em Andamento</Badge>
                          )}
                      </CardHeader>
                      
                      <CardContent className="px-5 pb-5">
                          <div className="space-y-4">
                              <div className="space-y-1.5">
                                  <div className="flex justify-between text-xs font-medium text-stone-500">
                                      <span>Progresso</span>
                                      <span>{pkg.progress}%</span>
                                  </div>
                                  <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                                      <div 
                                          className={`h-full transition-all ${pkg.status === 'completed' ? 'bg-emerald-500' : 'bg-[#C6A87C]'}`}
                                          style={{ width: `${pkg.progress}%` }}
                                      />
                                  </div>
                                  <p className="text-[10px] text-stone-400 text-right">
                                      {pkg.completedSessions} de {pkg.totalSessions} sessões
                                  </p>
                              </div>

                              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-50">
                                  <div className="bg-stone-50 rounded-lg p-2 flex flex-col justify-center">
                                      <span className="text-[10px] uppercase text-stone-400 font-bold block mb-1">Próxima</span>
                                      {pkg.nextSessionDate ? (
                                          <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
                                              <Calendar className="w-3 h-3 text-[#C6A87C]" />
                                              {format(pkg.nextSessionDate, "dd/MM")}
                                          </div>
                                      ) : <span className="text-xs text-stone-400 italic">--</span>}
                                  </div>
                                  <div className="bg-stone-50 rounded-lg p-2 flex flex-col justify-center">
                                      <span className="text-[10px] uppercase text-stone-400 font-bold block mb-1">Fim</span>
                                      {pkg.estimatedCompletion ? (
                                          <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
                                              <CheckCircle2 className="w-3 h-3 text-stone-400" />
                                              {format(pkg.estimatedCompletion, "dd/MM/yy")}
                                          </div>
                                      ) : <span className="text-xs text-stone-400 italic">--</span>}
                                  </div>
                              </div>
                          </div>
                      </CardContent>
                  </Card>
              ))}
          </div>
      )}

      {/* MODAL DE DETALHES RESPONSIVO */}
      <Dialog open={!!selectedPackage} onOpenChange={() => setSelectedPackage(null)}>
        <DialogContent className="w-[95vw] max-w-2xl bg-white border-stone-100 p-0 overflow-hidden rounded-xl">
            <DialogHeader className="px-6 py-4 border-b border-stone-100 bg-stone-50/50">
                <DialogTitle className="flex flex-col gap-1">
                    <span className="text-lg font-bold text-stone-800 line-clamp-1">{selectedPackage?.packageName}</span>
                    <span className="text-sm font-normal text-stone-500 flex items-center gap-2">
                        <span className="bg-white border border-stone-200 px-2 py-0.5 rounded text-xs text-stone-600 font-medium">{selectedPackage?.customerName}</span>
                    </span>
                </DialogTitle>
            </DialogHeader>
            
            <div className="p-4 md:p-6 bg-white">
                <h4 className="text-xs font-bold text-stone-400 uppercase mb-3 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4"/> Cronograma de Sessões
                </h4>
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                    {selectedPackage?.sessions.map((session) => (
                        <div 
                            key={session.id} 
                            onClick={() => handleGoToAppointment(session.parsedDate)}
                            className="group flex items-center justify-between p-3 rounded-lg border border-stone-100 bg-stone-50/30 hover:bg-stone-50 hover:border-[#C6A87C]/30 cursor-pointer transition-all active:scale-[0.99]"
                            title="Clique para ver na agenda"
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${
                                    session.status === 'completed' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 
                                    session.status === 'cancelled' ? 'bg-red-50 text-red-400 border border-red-100' :
                                    'bg-white border border-stone-200 text-stone-500'
                                }`}>
                                    {session.sessionNumber}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-stone-700 flex items-center gap-2">
                                        {format(session.parsedDate, "dd/MM/yyyy", { locale: ptBR })}
                                        <ExternalLink className="w-3 h-3 text-[#C6A87C] opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-stone-400">
                                        <Clock className="w-3 h-3" />
                                        <span>{format(session.parsedDate, "HH:mm")}</span>
                                        <span className="hidden sm:inline">•</span>
                                        <span className="hidden sm:inline truncate max-w-[100px]">{session.staff_name}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="text-right flex flex-col items-end gap-1 shrink-0">
                                {session.status === 'completed' && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 h-5 text-[10px]">Realizada</Badge>}
                                {session.status === 'confirmed' && <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 h-5 text-[10px]">Agendada</Badge>}
                                {session.status === 'pending' && <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 h-5 text-[10px]">Pendente</Badge>}
                                {session.status === 'cancelled' && <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 h-5 text-[10px]">Cancelada</Badge>}
                                
                                {(session.final_amount_centavos !== null && session.final_amount_centavos >= 0) ? (
                                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3"/> {session.final_amount_centavos === 0 ? "Incluso" : "Pago"}
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-stone-400">A pagar</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
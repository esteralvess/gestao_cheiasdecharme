import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter"; 
import { 
  Package, 
  Calendar, 
  ArrowRight,
  CalendarDays,
  Search,
  CheckCircle2,
  Clock,
  ExternalLink,
  MoreHorizontal,
  Wallet,
  Sparkles,
  History
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { appointmentsAPI } from "@/services/api";
import { format, parseISO, isAfter, startOfDay, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";

// --- TIPOS ---
interface PackageGroup {
  id: string;
  customerName: string;
  packageName: string;
  totalSessions: number;
  completedSessions: number;
  sessions: any[];
  nextSession?: any; // Objeto completo da próxima sessão
  estimatedCompletion?: Date;
  status: 'active' | 'completed';
  progress: number;
  paymentStatus: 'paid' | 'partial' | 'pending';
}

export default function PackageManagement() {
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<PackageGroup | null>(null);
  const [activeTab, setActiveTab] = useState("active");

  const { data: appointments = [], isLoading } = useQuery({ 
    queryKey: ['appointments'], 
    queryFn: appointmentsAPI.getAll 
  });

  // --- PROCESSAMENTO INTELIGENTE ---
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
            progress: 0,
            paymentStatus: 'pending'
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
      
      // Encontra a próxima sessão futura ou pendente
      const next = group.sessions.find(s => 
        (s.status === 'confirmed' || s.status === 'pending') && 
        (isAfter(s.parsedDate, startOfDay(new Date())) || isToday(s.parsedDate))
      );
      group.nextSession = next;

      const last = group.sessions[group.sessions.length - 1];
      group.estimatedCompletion = last ? last.parsedDate : undefined;

      group.progress = Math.min(100, Math.round((group.completedSessions / group.totalSessions) * 100));

      if (group.completedSessions >= group.totalSessions) {
        group.status = 'completed';
      }

      // Verifica Pagamento (Sessão 1)
      const firstSession = group.sessions.find(s => s.sessionNumber === 1);
      if (firstSession?.status === 'completed') {
          group.paymentStatus = 'paid';
      } else if (firstSession?.final_amount_centavos > 0) {
          group.paymentStatus = 'pending';
      }

      return group;
    }).sort((a, b) => {
        // Ordenação: Próxima sessão mais próxima primeiro
        if (a.nextSession && b.nextSession) return a.nextSession.parsedDate.getTime() - b.nextSession.parsedDate.getTime();
        return 0;
    });

  }, [appointments]);

  const filteredPackages = useMemo(() => {
    return packages.filter(p => {
      const matchSearch = p.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.packageName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchTab = activeTab === 'all' ? true : p.status === activeTab;
      return matchSearch && matchTab;
    });
  }, [packages, searchTerm, activeTab]);

  const handleGoToAppointment = (date: Date) => {
      const dateString = format(date, 'yyyy-MM-dd');
      navigate(`/appointments?date=${dateString}`);
  };

  const getDayLabel = (date: Date) => {
      if (isToday(date)) return "Hoje";
      if (isTomorrow(date)) return "Amanhã";
      return format(date, "dd MMM", { locale: ptBR });
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in bg-stone-50/50 dark:bg-stone-950 min-h-screen font-sans pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-stone-900 rounded-lg shadow-sm border border-stone-100 dark:border-stone-800">
               <Package className="w-5 h-5 text-[#C6A87C]" />
            </div>
            Gestão de Pacotes
          </h1>
          <p className="text-stone-500 text-sm mt-1 ml-1">
            Controle de assinaturas e tratamentos recorrentes.
          </p>
        </div>
        
        <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <Input 
                placeholder="Buscar cliente..." 
                className="pl-9 bg-white border-stone-200 focus:border-[#C6A87C] focus:ring-0 w-full rounded-xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      {/* TABS E LISTAGEM */}
      <Tabs defaultValue="active" onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-white p-1 rounded-xl border border-stone-200 w-full md:w-auto grid grid-cols-2 md:inline-flex mb-6">
              <TabsTrigger value="active" className="rounded-lg data-[state=active]:bg-[#C6A87C] data-[state=active]:text-white">Em Andamento</TabsTrigger>
              <TabsTrigger value="completed" className="rounded-lg data-[state=active]:bg-[#C6A87C] data-[state=active]:text-white">Concluídos</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-0">
              {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                     <div className="w-8 h-8 border-4 border-[#C6A87C]/30 border-t-[#C6A87C] rounded-full animate-spin"></div>
                     <p className="text-stone-400 text-sm">Carregando...</p>
                  </div>
              ) : filteredPackages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-stone-200 rounded-3xl bg-white/50 text-stone-400">
                      <Package className="w-12 h-12 opacity-20 mb-4" />
                      <p className="font-medium">Nenhum pacote {activeTab === 'active' ? 'ativo' : 'concluído'} encontrado.</p>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredPackages.map((pkg) => (
                          <Card key={pkg.id} className="group hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-stone-100 bg-white cursor-pointer rounded-2xl overflow-hidden" onClick={() => setSelectedPackage(pkg)}>
                              <div className={`h-2 w-full ${pkg.status === 'completed' ? 'bg-emerald-500' : 'bg-[#C6A87C]'}`} />
                              
                              <CardHeader className="pb-3 pt-5 px-5">
                                  <div className="flex justify-between items-start">
                                      <div>
                                          <CardTitle className="text-base font-bold text-stone-800">{pkg.customerName}</CardTitle>
                                          <CardDescription className="text-xs text-stone-500 line-clamp-1 mt-1 font-medium">{pkg.packageName}</CardDescription>
                                      </div>
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${pkg.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`} title={pkg.paymentStatus === 'paid' ? 'Pago' : 'Pagamento Pendente'}>
                                          <Wallet className="w-4 h-4" />
                                      </div>
                                  </div>
                              </CardHeader>
                              
                              <CardContent className="px-5 pb-4">
                                  {/* PRÓXIMA SESSÃO (DESTAQUE) */}
                                  <div className="bg-stone-50 rounded-xl p-3 mb-4 border border-stone-100 flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                          <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center ${pkg.nextSession ? 'bg-white shadow-sm text-stone-700' : 'bg-stone-200 text-stone-400'}`}>
                                              {pkg.nextSession ? (
                                                  <>
                                                      <span className="text-[9px] font-bold uppercase">{format(pkg.nextSession.parsedDate, 'MMM', {locale: ptBR})}</span>
                                                      <span className="text-sm font-bold">{format(pkg.nextSession.parsedDate, 'dd')}</span>
                                                  </>
                                              ) : <CheckCircle2 className="w-5 h-5"/>}
                                          </div>
                                          <div>
                                              <p className="text-[10px] font-bold uppercase text-stone-400">
                                                  {pkg.status === 'completed' ? 'Finalizado' : 'Próxima Sessão'}
                                              </p>
                                              <p className="text-xs font-bold text-stone-700">
                                                  {pkg.nextSession ? `${getDayLabel(pkg.nextSession.parsedDate)} às ${format(pkg.nextSession.parsedDate, 'HH:mm')}` : 'Todas concluídas'}
                                              </p>
                                          </div>
                                      </div>
                                      {pkg.nextSession && <ArrowRight className="w-4 h-4 text-[#C6A87C] opacity-50 group-hover:opacity-100 transition-opacity" />}
                                  </div>

                                  <div className="space-y-1.5">
                                      <div className="flex justify-between text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                                          <span>Progresso</span>
                                          <span>{pkg.completedSessions}/{pkg.totalSessions}</span>
                                      </div>
                                      <Progress value={pkg.progress} className="h-2 bg-stone-100" />
                                  </div>
                              </CardContent>
                          </Card>
                      ))}
                  </div>
              )}
          </TabsContent>
      </Tabs>

      {/* MODAL DE DETALHES (TIMELINE) */}
      <Dialog open={!!selectedPackage} onOpenChange={() => setSelectedPackage(null)}>
        <DialogContent className="w-[95vw] max-w-lg bg-white border-none p-0 overflow-hidden rounded-2xl h-[80vh] flex flex-col">
            <DialogHeader className="px-6 py-6 border-b border-stone-100 bg-[#FAF8F5]">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-[#C6A87C] text-white flex items-center justify-center font-bold text-lg">
                        {selectedPackage?.customerName.charAt(0)}
                    </div>
                    <div>
                        <DialogTitle className="text-lg font-bold text-stone-800">{selectedPackage?.customerName}</DialogTitle>
                        <DialogDescription className="text-xs text-[#C6A87C] font-medium uppercase tracking-wide">
                            {selectedPackage?.packageName}
                        </DialogDescription>
                    </div>
                </div>
                
                {/* INFO RÁPIDA */}
                <div className="flex gap-4 mt-2">
                    <div className="flex items-center gap-2 text-xs text-stone-500 bg-white px-3 py-1.5 rounded-full shadow-sm">
                        <Wallet className="w-3 h-3 text-emerald-500"/> 
                        {selectedPackage?.paymentStatus === 'paid' ? 'Pago' : 'Pendente'}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-stone-500 bg-white px-3 py-1.5 rounded-full shadow-sm">
                        <History className="w-3 h-3 text-blue-500"/> 
                        {selectedPackage?.completedSessions} de {selectedPackage?.totalSessions} realizados
                    </div>
                </div>
            </DialogHeader>
            
            <ScrollArea className="flex-1 p-6 bg-white">
                <div className="space-y-0 relative">
                    {/* Linha vertical da timeline */}
                    <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-stone-100"></div>

                    {selectedPackage?.sessions.map((session, idx) => {
                        const isPastItem = session.status === 'completed';
                        const isNext = session.id === selectedPackage.nextSession?.id;
                        
                        return (
                            <div key={session.id} className="relative pl-14 pb-8 last:pb-0 group">
                                {/* Bolinha da Timeline */}
                                <div className={`absolute left-[1.15rem] top-1 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 transition-colors ${
                                    isPastItem ? 'bg-emerald-500 border-emerald-500 text-white' : 
                                    isNext ? 'bg-white border-[#C6A87C] text-[#C6A87C] ring-4 ring-[#C6A87C]/10' : 
                                    'bg-white border-stone-200 text-stone-300'
                                }`}>
                                    {isPastItem ? <CheckCircle2 className="w-3 h-3"/> : <span className="text-[9px] font-bold">{session.sessionNumber}</span>}
                                </div>

                                {/* Conteúdo do Card */}
                                <div 
                                    onClick={() => handleGoToAppointment(session.parsedDate)}
                                    className={`relative p-3 rounded-xl border transition-all cursor-pointer ${
                                        isNext ? 'bg-white border-[#C6A87C] shadow-md -translate-y-0.5' : 
                                        isPastItem ? 'bg-stone-50 border-transparent opacity-70 hover:opacity-100' :
                                        'bg-white border-stone-100 hover:border-stone-300'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-sm font-bold ${isNext ? 'text-stone-800' : 'text-stone-600'}`}>
                                                {format(session.parsedDate, "dd 'de' MMMM", { locale: ptBR })}
                                            </span>
                                            {isNext && <Badge className="bg-[#C6A87C] text-[9px] h-4">Próxima</Badge>}
                                        </div>
                                        <ExternalLink className="w-3 h-3 text-stone-300 group-hover:text-[#C6A87C]" />
                                    </div>
                                    
                                    <div className="flex items-center gap-2 text-xs text-stone-500 mb-2">
                                        <Clock className="w-3 h-3"/> {format(session.parsedDate, "HH:mm")}
                                        <span className="text-stone-300">|</span>
                                        <span>{session.staff_name}</span>
                                    </div>

                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-stone-100 border-dashed">
                                        <span className="text-[10px] uppercase font-bold text-stone-400">
                                            {session.service_name}
                                        </span>
                                        {/* Status Financeiro da Sessão */}
                                        {session.final_amount_centavos === 0 ? (
                                            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3"/> Pago (Pacote)
                                            </span>
                                        ) : session.status === 'completed' ? (
                                            <span className="text-[10px] font-bold text-emerald-600">Pago</span>
                                        ) : (
                                            <span className="text-[10px] text-stone-400">A processar</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
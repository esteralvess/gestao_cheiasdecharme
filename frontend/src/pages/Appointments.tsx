import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  List, 
  Calendar as CalendarIcon, 
  Trash2, 
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import AppointmentCard from "@/components/AppointmentCard";
import CalendarView from "@/components/CalendarView";
import { PaymentConfirmationModal } from "@/components/PaymentConfirmationModal";
import { format, parseISO, setHours, setMinutes, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { appointmentsAPI, customersAPI, staffAPI, servicesAPI, locationsAPI } from "@/services/api";

// --- TIPAGEM DO STATUS (CORREÇÃO FUNDAMENTAL) ---
type AppointmentStatus = "confirmed" | "completed" | "cancelled" | "pending";

// --- INTERFACES ---
interface AppointmentFromAPI { 
  id: string; 
  customer_name: string; 
  service_name: string; 
  staff_name: string; 
  start_time: string; 
  end_time: string; 
  status: AppointmentStatus; // ✅ Usando o tipo específico
  notes?: string; 
  customer?: string; 
  staff?: string; 
  service?: string; 
  location?: string; 
  final_amount_centavos?: number;
  service_price_centavos?: number;
}

interface ProcessedAppointment { 
  id: string; 
  title: string; 
  start: Date; 
  end: Date; 
  resourceId: string; 
  status: AppointmentStatus; // ✅ Usando o tipo específico (isso resolve o erro do CalendarView)
  originalData: AppointmentFromAPI; 
  customerName: string;
  serviceName: string;
  staffName: string;
  startTime: Date;
  endTime: Date;
}

export default function Appointments() {
  const queryClient = useQueryClient();
  
  // Estados
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [selectedStaff, setSelectedStaff] = useState<string>("all");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");

  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [appointmentToPay, setAppointmentToPay] = useState<any>(null);
  
  // Formulário
  const [formData, setFormData] = useState({
    customer: "", customerName: "", customerPhone: "", 
    service: "", staff: "", location: "", 
    date: new Date(), time: "09:00", notes: ""
  });

  // Queries
  const { data: appointments = [], isLoading } = useQuery<any[]>({ queryKey: ['appointments'], queryFn: appointmentsAPI.getAll });
  const { data: customers = [] } = useQuery<any[]>({ queryKey: ['customers'], queryFn: customersAPI.getAll });
  const { data: staffList = [] } = useQuery<any[]>({ queryKey: ['staff'], queryFn: staffAPI.getAll });
  const { data: services = [] } = useQuery<any[]>({ queryKey: ['services'], queryFn: servicesAPI.getAll });
  const { data: locations = [] } = useQuery<any[]>({ queryKey: ['locations'], queryFn: locationsAPI.getAll });

  // Processamento
  const processedAppointments: ProcessedAppointment[] = useMemo(() => {
    return appointments.map((app: any) => ({
      id: app.id,
      title: `${app.customer_name} - ${app.service_name}`,
      start: parseISO(app.start_time),
      end: parseISO(app.end_time),
      resourceId: app.staff,
      status: app.status as AppointmentStatus, // ✅ Forçando o tipo para o TS aceitar
      originalData: app,
      customerName: app.customer_name,
      serviceName: app.service_name,
      staffName: app.staff_name,
      startTime: parseISO(app.start_time),
      endTime: parseISO(app.end_time)
    }));
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    return processedAppointments.filter(app => {
      const matchStaff = selectedStaff === "all" || app.originalData.staff === selectedStaff;
      const matchLocation = selectedLocation === "all" || app.originalData.location === selectedLocation;
      return matchStaff && matchLocation;
    });
  }, [processedAppointments, selectedStaff, selectedLocation]);

  const dailyAppointments = useMemo(() => {
    return filteredAppointments
      .filter(app => isSameDay(app.start, selectedDate))
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map(app => ({
        id: app.id,
        customerName: app.originalData.customer_name,
        serviceName: app.originalData.service_name,
        staffName: app.originalData.staff_name,
        startTime: app.start,
        endTime: app.end,
        status: app.status,
        originalData: app.originalData
      }));
  }, [filteredAppointments, selectedDate]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: appointmentsAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setIsModalOpen(false);
      toast.success("Agendamento criado!");
    },
    onError: () => toast.error("Erro ao criar.")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => appointmentsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setIsModalOpen(false);
      setEditingAppointment(null);
      toast.success("Atualizado com sucesso!");
    },
    onError: () => toast.error("Erro ao atualizar.")
  });

  const deleteMutation = useMutation({
    mutationFn: appointmentsAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setIsModalOpen(false);
      toast.success("Removido com sucesso.");
    },
    onError: () => toast.error("Erro ao remover.")
  });

  // Handlers
  const handleNewAppointmentClick = () => {
    setEditingAppointment(null);
    setFormData({
      customer: "", customerName: "", customerPhone: "",
      service: "", staff: "", location: selectedLocation !== "all" ? selectedLocation : "",
      date: selectedDate, time: "09:00", notes: ""
    });
    setIsModalOpen(true);
  };

  const handleEditClick = (appointmentData: any) => {
    const data = appointmentData.originalData || appointmentData;
    setEditingAppointment(data);
    const startDate = parseISO(data.start_time);
    
    setFormData({
      customer: data.customer || "",
      customerName: data.customer_name || "",
      customerPhone: "", 
      service: data.service || "",
      staff: data.staff || "",
      location: data.location || "",
      date: startDate,
      time: format(startDate, "HH:mm"),
      notes: data.notes || ""
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.service || !formData.staff || !formData.date || !formData.time) {
      toast.warning("Preencha os campos obrigatórios.");
      return;
    }

    const [hours, minutes] = formData.time.split(':').map(Number);
    const startDateTime = setMinutes(setHours(formData.date, hours), minutes);

    const payload: any = {
      service: formData.service,
      staff: formData.staff,
      location: formData.location,
      start_time: startDateTime.toISOString(),
      notes: formData.notes
    };

    if (formData.customer && formData.customer !== "new") {
      payload.customer = formData.customer;
    } else {
      payload.customer_name = formData.customerName;
      payload.customer_phone = formData.customerPhone;
    }

    if (editingAppointment) {
      updateMutation.mutate({ id: editingAppointment.id, data: payload });
    } else {
      const createPayload = {
        ...payload,
        items: [{ service: payload.service, staff: payload.staff, start_time: payload.start_time }]
      };
      createMutation.mutate(createPayload);
    }
  };

  const handleStatusChange = (newStatus: string) => {
    if (!editingAppointment) return;
    if (newStatus === 'completed') {
      setIsModalOpen(false);
      setAppointmentToPay(editingAppointment);
      setPaymentModalOpen(true);
    } else {
      updateMutation.mutate({ id: editingAppointment.id, data: { status: newStatus } });
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 bg-stone-50/50 dark:bg-stone-950 min-h-screen font-sans">
      
      {/* --- CABEÇALHO --- */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-stone-900 rounded-lg shadow-sm border border-stone-100 dark:border-stone-800">
               <CalendarIcon className="w-5 h-5 text-[#C6A87C]" />
            </div>
            Agenda
          </h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm mt-1 ml-1">
            Gerencie atendimentos e disponibilidade.
          </p>
        </div>

        {/* BARRA DE FERRAMENTAS */}
        <div className="w-full xl:w-auto flex flex-col md:flex-row gap-3 bg-white dark:bg-stone-900 p-2 rounded-xl border border-stone-100 dark:border-stone-800 shadow-sm">
          
          {/* 1. Seletor de Data */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800 min-w-[140px]">
                <CalendarIcon className="mr-2 h-4 w-4 text-[#C6A87C]" />
                {selectedDate ? format(selectedDate, "dd/MM/yyyy") : <span>Data</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus />
            </PopoverContent>
          </Popover>

          {/* 2. Filtros (Unidade e Staff) */}
          <div className="flex gap-2 flex-1 md:flex-none">
             <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger className="w-full md:w-[140px] border-stone-200 dark:border-stone-800">
                  <SelectValue placeholder="Unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Unidades</SelectItem>
                  {locations.map((loc: any) => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}
                </SelectContent>
             </Select>

             <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                <SelectTrigger className="w-full md:w-[140px] border-stone-200 dark:border-stone-800">
                  <SelectValue placeholder="Profissional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Prof.</SelectItem>
                  {staffList.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
             </Select>
          </div>

          <div className="w-px h-8 bg-stone-200 dark:bg-stone-800 hidden md:block mx-1"></div>

          {/* 3. Toggle View & Novo */}
          <div className="flex gap-2 w-full md:w-auto">
              <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-lg">
                <Button 
                   variant="ghost" size="icon"
                   className={`h-8 w-8 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-stone-700 text-[#C6A87C] shadow-sm' : 'text-stone-400'}`}
                   onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button 
                   variant="ghost" size="icon"
                   className={`h-8 w-8 rounded-md transition-all ${viewMode === 'calendar' ? 'bg-white dark:bg-stone-700 text-[#C6A87C] shadow-sm' : 'text-stone-400'}`}
                   onClick={() => setViewMode("calendar")}
                >
                  <CalendarIcon className="h-4 w-4" />
                </Button>
              </div>

              <Button onClick={handleNewAppointmentClick} className="flex-1 md:flex-none bg-[#C6A87C] hover:bg-[#B08D55] text-white shadow-sm transition-all font-medium px-6">
                <Plus className="w-4 h-4 mr-2" />
                Novo Agendamento
              </Button>
          </div>
        </div>
      </div>

      {/* --- ÁREA PRINCIPAL --- */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
           <div className="w-8 h-8 border-4 border-[#C6A87C]/30 border-t-[#C6A87C] rounded-full animate-spin"></div>
           <p className="text-stone-400 text-sm">Carregando sua agenda...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-100 dark:border-stone-800 shadow-sm overflow-hidden min-h-[500px]">
          
          {viewMode === 'list' ? (
            <div className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-100 dark:border-stone-800">
                 <div className="flex items-center gap-3">
                    <div className="text-3xl font-bold text-stone-800 dark:text-stone-100">{format(selectedDate, "dd")}</div>
                    <div className="flex flex-col">
                       <span className="text-sm font-medium text-stone-500 uppercase tracking-wide">{format(selectedDate, "MMMM", { locale: ptBR })}</span>
                       <span className="text-xs text-stone-400 capitalize">{format(selectedDate, "EEEE", { locale: ptBR })}</span>
                    </div>
                 </div>
                 <div className="px-3 py-1 bg-stone-100 dark:bg-stone-800 rounded-full text-xs font-medium text-stone-500">
                    {dailyAppointments.length} agendamentos
                 </div>
              </div>
              
              <div className="space-y-3">
                {dailyAppointments.length > 0 ? (
                  dailyAppointments.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      {...appointment}
                      onClick={() => handleEditClick(appointment)} 
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                     <div className="w-16 h-16 bg-stone-50 dark:bg-stone-800 rounded-full flex items-center justify-center mb-4">
                        <Clock className="w-8 h-8 text-stone-300" />
                     </div>
                     <h3 className="text-stone-600 dark:text-stone-300 font-medium">Dia Livre</h3>
                     <p className="text-stone-400 text-sm mt-1">Nenhum agendamento para esta data.</p>
                     <Button variant="ghost" onClick={handleNewAppointmentClick} className="text-[#C6A87C] mt-2 hover:bg-stone-50">
                        + Adicionar agora
                     </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full h-full p-2">
               <div className="w-full h-full">
                  <CalendarView
                    appointments={processedAppointments}
                    onAppointmentClick={handleEditClick}
                    onDateClick={(date) => { setSelectedDate(date); setViewMode("list"); }}
                  />
               </div>
            </div>
          )}
        </div>
      )}

      {/* --- MODAL (NOVO / EDITAR) --- */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-white dark:bg-stone-950 border-stone-100 dark:border-stone-800 p-0 gap-0">
          
          <DialogHeader className="px-6 py-4 border-b border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50">
            <DialogTitle className="text-lg font-bold text-stone-800 dark:text-stone-100">
               {editingAppointment ? "Detalhes do Agendamento" : "Novo Agendamento"}
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 space-y-5">
            {/* Cliente */}
            <div className="space-y-1.5">
              <Label className="text-stone-500 text-xs uppercase tracking-wider font-semibold">Cliente</Label>
              <Select 
                value={formData.customer} 
                onValueChange={(val) => setFormData({...formData, customer: val})}
                disabled={!!editingAppointment}
              >
                <SelectTrigger className="h-11 bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 focus:ring-[#C6A87C]/20">
                  <SelectValue placeholder="Selecione o cliente..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new" className="text-[#C6A87C] font-medium">+ Cadastrar Novo</SelectItem>
                  {customers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {formData.customer === "new" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-stone-50 dark:bg-stone-900 rounded-xl border border-stone-100 dark:border-stone-800 animate-in slide-in-from-top-2">
                <div>
                   <Label className="text-xs text-stone-500">Nome Completo</Label>
                   <Input className="mt-1 bg-white dark:bg-stone-950" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} />
                </div>
                <div>
                   <Label className="text-xs text-stone-500">WhatsApp</Label>
                   <Input className="mt-1 bg-white dark:bg-stone-950" placeholder="(11) 9..." value={formData.customerPhone} onChange={e => setFormData({...formData, customerPhone: e.target.value})} />
                </div>
              </div>
            )}

            {/* Serviço e Profissional */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-stone-500 text-xs uppercase tracking-wider font-semibold">Serviço</Label>
                <Select value={formData.service} onValueChange={(val) => setFormData({...formData, service: val})}>
                  <SelectTrigger className="h-11 bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {services.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name} - R${(s.price_centavos/100).toFixed(2)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-stone-500 text-xs uppercase tracking-wider font-semibold">Profissional</Label>
                <Select value={formData.staff} onValueChange={(val) => setFormData({...formData, staff: val})}>
                  <SelectTrigger className="h-11 bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {staffList.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Data e Hora */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
               <div className="space-y-1.5 col-span-2 sm:col-span-1">
                 <Label className="text-stone-500 text-xs uppercase tracking-wider font-semibold">Data</Label>
                 <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full h-11 justify-start text-left font-normal bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800">
                        <CalendarIcon className="mr-2 h-4 w-4 text-stone-400" />
                        {formData.date ? format(formData.date, "dd/MM/yyyy") : <span>Data</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={formData.date} onSelect={(d) => d && setFormData({...formData, date: d})} initialFocus /></PopoverContent>
                 </Popover>
               </div>
               
               <div className="space-y-1.5">
                 <Label className="text-stone-500 text-xs uppercase tracking-wider font-semibold">Horário</Label>
                 <Input type="time" className="h-11 bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800" value={formData.time} onChange={(e) => setFormData({...formData, time: e.target.value})} />
               </div>

               <div className="space-y-1.5">
                 <Label className="text-stone-500 text-xs uppercase tracking-wider font-semibold">Unidade</Label>
                 <Select value={formData.location} onValueChange={(val) => setFormData({...formData, location: val})}>
                    <SelectTrigger className="h-11 bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800"><SelectValue placeholder="Local" /></SelectTrigger>
                    <SelectContent>{locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                 </Select>
               </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-stone-500 text-xs uppercase tracking-wider font-semibold">Observações</Label>
              <Textarea 
                placeholder="Anotações internas..." 
                className="bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 resize-none h-20"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
              />
            </div>
            
            {/* Ações de Status */}
            {editingAppointment && (
              <div className="pt-4 border-t border-stone-100 dark:border-stone-800">
                 <Label className="text-xs text-stone-400 uppercase mb-3 block">Alterar Status</Label>
                 <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => handleStatusChange('confirmed')} className="text-blue-600 border-blue-200 hover:bg-blue-50 h-9">Confirmar</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => handleStatusChange('completed')} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 h-9">Concluir & Pagar</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => handleStatusChange('cancelled')} className="text-red-600 border-red-200 hover:bg-red-50 h-9">Cancelar</Button>
                 </div>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 bg-stone-50 dark:bg-stone-900 border-t border-stone-100 dark:border-stone-800 flex-col sm:flex-row gap-3">
            {editingAppointment && (
               <Button type="button" variant="ghost" onClick={() => { 
                  if(confirm("Deseja realmente excluir este agendamento?")) deleteMutation.mutate(editingAppointment.id) 
               }} className="text-red-500 hover:text-red-700 hover:bg-red-50 sm:mr-auto">
                 <Trash2 className="w-4 h-4 mr-2" /> Excluir
               </Button>
            )}
            <div className="flex gap-3 w-full sm:w-auto">
                <Button variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1 sm:flex-none">Cancelar</Button>
                <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 sm:flex-none bg-[#C6A87C] hover:bg-[#B08D55] text-white font-semibold shadow-md">
                   {createMutation.isPending || updateMutation.isPending ? "Salvando..." : "Salvar Agendamento"}
                </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL PAGAMENTO */}
      {appointmentToPay && (
        <PaymentConfirmationModal
          isOpen={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          onConfirm={() => {
            setPaymentModalOpen(false);
            updateMutation.mutate({ id: appointmentToPay.id, data: { status: 'completed' } });
          }} 
          appointment={appointmentToPay}
        />
      )}
    </div>
  );
}
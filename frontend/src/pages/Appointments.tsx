import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  List, 
  Calendar as CalendarIcon, 
  Trash2, 
  Clock,
  Sparkles,
  Package, 
  Repeat,
  CalendarDays,
  AlertCircle,
  Wallet,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; 
import { Badge } from "@/components/ui/badge"; 
import AppointmentCard from "@/components/AppointmentCard";
import CalendarView from "@/components/CalendarView";
import { PaymentConfirmationModal } from "@/components/PaymentConfirmationModal";
import { format, parseISO, setHours, setMinutes, isSameDay, addMinutes, getDay, addDays, startOfDay, isBefore, areIntervalsOverlapping, getHours, getMinutes, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { appointmentsAPI, customersAPI, staffAPI, servicesAPI, locationsAPI, staffServicesAPI, staffShiftsAPI, promotionsAPI } from "@/services/api";

// --- TIPOS ---
type AppointmentStatus = "confirmed" | "completed" | "cancelled" | "pending";

// Adicionei a interface que faltava aqui 👇
interface StaffShift { 
  id?: number; 
  staff_id: string; 
  location_id: string; 
  weekday: number; 
  start_time: string; 
  end_time: string; 
}

interface AppointmentFromAPI { 
  id: string; 
  customer_name: string; 
  service_name: string; 
  staff_name: string; 
  start_time: string; 
  end_time: string; 
  status: AppointmentStatus; 
  notes?: string; 
  customer?: string; 
  staff?: string; 
  service?: string; 
  location?: string; 
  final_amount_centavos?: number;
}

interface ProcessedAppointment { 
  id: string; 
  title: string; 
  start: Date; 
  end: Date; 
  resourceId: string; 
  status: AppointmentStatus; 
  originalData: AppointmentFromAPI; 
  customerName: string;
  serviceName: string;
  staffName: string;
  startTime: Date;
  endTime: Date;
}

// --- COMPONENTE AUXILIAR: PREVISÃO DE PACOTE ---
function PackagePreview({ startDate, totalSessions, interval }: { startDate: Date | undefined, totalSessions: number, interval: number }) {
    const dates = useMemo(() => {
        if (!startDate || totalSessions <= 0) return [];
        return Array.from({ length: totalSessions }).map((_, i) => addDays(startDate, i * interval));
    }, [startDate, totalSessions, interval]);

    if (!startDate) return null;

    return (
        <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 mt-2">
            <p className="text-xs font-bold text-stone-500 uppercase mb-2 flex items-center gap-2">
               <CalendarDays className="w-3 h-3"/> Previsão das Sessões ({totalSessions})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[150px] overflow-y-auto pr-1">
                {dates.map((date, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs bg-white p-2 rounded border border-stone-100 shadow-sm">
                        <span className="font-bold text-[#C6A87C] w-5">{idx + 1}ª</span>
                        <span className="text-stone-600">{format(date, "dd/MM (EEE)", { locale: ptBR })}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default function Appointments() {
  const queryClient = useQueryClient();
  
  // Lê o parametro da URL (ex: ?date=2023-12-25)
  const searchParams = new URLSearchParams(window.location.search);
  const urlDate = searchParams.get('date');
  
  // Se tiver data na URL, usa ela. Se não, usa Hoje.
  const initialDate = useMemo(() => {
      if (urlDate) {
          const parsed = parseISO(urlDate);
          if (isValid(parsed)) return parsed;
      }
      return new Date();
  }, [urlDate]);

  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  
  // Atualiza se a URL mudar (opcional, para navegação interna funcionar bem)
  useEffect(() => {
      if (urlDate) {
          const parsed = parseISO(urlDate);
          if (isValid(parsed)) setSelectedDate(parsed);
      }
  }, [urlDate]);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>("all");
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string>("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [appointmentToPay, setAppointmentToPay] = useState<any>(null);
  
  const [agendamentoType, setAgendamentoType] = useState<"avulso" | "combo" | "pacote">("avulso");
  
  const [formData, setFormData] = useState({
    customer: "", customerName: "", customerPhone: "", 
    service: "", staff: "", location: "", promotion: "",
    date: undefined as Date | undefined,
    time: "", notes: "", 
    staffMapping: {} as Record<number, string>,
    packageDates: [] as Date[]
  });

  const { data: appointments = [], isLoading } = useQuery<any[]>({ queryKey: ['appointments'], queryFn: appointmentsAPI.getAll });
  const { data: customers = [] } = useQuery<any[]>({ queryKey: ['customers'], queryFn: customersAPI.getAll });
  const { data: staffList = [] } = useQuery<any[]>({ queryKey: ['staff'], queryFn: staffAPI.getAll });
  const { data: services = [] } = useQuery<any[]>({ queryKey: ['services'], queryFn: servicesAPI.getAll });
  const { data: locations = [] } = useQuery<any[]>({ queryKey: ['locations'], queryFn: locationsAPI.getAll });
  const { data: staffServices = [] } = useQuery<any[]>({ queryKey: ['staffServices'], queryFn: staffServicesAPI.getAll });
  const { data: staffShifts = [] } = useQuery<StaffShift[]>({ queryKey: ['staffShifts'], queryFn: staffShiftsAPI.getAll });
  const { data: promotions = [] } = useQuery<any[]>({ queryKey: ['promotions'], queryFn: promotionsAPI.getAll });

  // --- LÓGICA DE NEGÓCIO ---

  const getQualifiedStaff = (serviceId: string) => {
      const qualifiedIds = staffServices
          .filter((ss: any) => ss.service_id === serviceId)
          .map((ss: any) => ss.staff_id || ss.staff);
      
      if (formData.location) {
          const staffInLocation = new Set(staffShifts
            .filter((shift: any) => String(shift.location_id) === String(formData.location))
            .map((shift: any) => String(shift.staff_id)));
          return staffList.filter((s:any) => qualifiedIds.includes(s.id) && staffInLocation.has(s.id));
      }
      return staffList.filter((s:any) => qualifiedIds.includes(s.id));
  };

  const availableStaffSimple = useMemo(() => {
     if (agendamentoType === 'avulso' && formData.service) {
         return getQualifiedStaff(formData.service);
     }
     if (agendamentoType === 'pacote' && formData.promotion) {
         const promo = promotions.find((p:any) => p.id === formData.promotion);
         const firstItem = promo?.items?.[0];
         const serviceId = firstItem?.service || firstItem?.service_id;
         if (serviceId) return getQualifiedStaff(serviceId);
     }
     if (formData.location) {
         const staffInLocation = new Set(staffShifts
            .filter((shift: any) => String(shift.location_id) === String(formData.location))
            .map((shift: any) => String(shift.staff_id)));
         return staffList.filter((s:any) => staffInLocation.has(s.id));
     }
     return staffList;
  }, [agendamentoType, formData.service, formData.promotion, formData.location, staffServices, staffShifts, promotions, staffList]);

  // 2. Validação de Data (Escala + Local)
  const isDateDisabledCheck = (date: Date, staffId?: string) => {
    if (isBefore(date, startOfDay(new Date()))) return true;
    if (!formData.location) return false; 
    
    const targetStaff = staffId || formData.staff;
    if (!targetStaff) return false;

    const jsDay = getDay(date); 
    const dbDay = jsDay === 0 ? 7 : jsDay;

    const hasShift = staffShifts.some((shift: any) => {
      const staffMatch = String(shift.staff_id) === String(targetStaff);
      const dayMatch = Number(shift.weekday) === dbDay; 
      const locationMatch = String(shift.location_id) === String(formData.location);
      return staffMatch && dayMatch && locationMatch;
    });
    return !hasShift; 
  };
  
  const isDateDisabled = (date: Date) => {
      if (!editingAppointment && isBefore(date, startOfDay(new Date()))) return true;
      
      if (agendamentoType === 'combo' && formData.promotion) {
          const promo = promotions.find((p:any) => p.id === formData.promotion);
          if (!promo) return true;
          
          const allStaffsSelected = promo.items.every((_: any, idx: number) => !!formData.staffMapping[idx]);
          
          if (!allStaffsSelected) return false; 

          return !promo.items.every((_: any, idx: number) => {
             const staffId = formData.staffMapping[idx];
             return !isDateDisabledCheck(date, staffId);
          });
      }
      return isDateDisabledCheck(date);
  };

  // 3. Cálculo de Horários Disponíveis
  const availableTimeSlots = useMemo(() => {
      if (!formData.date || !formData.location) return [];
      const jsDay = getDay(formData.date);
      const dbDay = jsDay === 0 ? 7 : jsDay;

      // ==========================================
      // LÓGICA PARA COMBO (ENCADEAMENTO)
      // ==========================================
      if (agendamentoType === 'combo' && formData.promotion) {
          const promo = promotions.find((p:any) => p.id === formData.promotion);
          if (!promo || !promo.items) return [];

          const allStaffsSelected = promo.items.every((_: any, idx: number) => !!formData.staffMapping[idx]);
          if (!allStaffsSelected) return [];

          const sequence: any[] = [];
          promo.items.forEach((item: any, idx: number) => {
              const srv = services.find((s:any) => s.id === (item.service || item.service_id));
              const staffId = formData.staffMapping[idx];
              if (srv && staffId) {
                  for (let q = 0; q < (item.quantity || 1); q++) {
                      sequence.push({
                          service: srv,
                          staffId: staffId,
                          duration: Number(srv.default_duration_min) || 30
                      });
                  }
              }
          });

          if (sequence.length === 0) return [];

          const firstStaffId = sequence[0].staffId;
          const firstShifts = staffShifts.filter((s: any) => 
              String(s.staff_id) === String(firstStaffId) && 
              Number(s.weekday) === dbDay && 
              String(s.location_id) === String(formData.location)
          );

          if (firstShifts.length === 0) return null; 

          const validSlots = new Set<string>();

          firstShifts.forEach((shift: any) => {
              const [startH, startM] = shift.start_time.split(':').map(Number);
              const [endH, endM] = shift.end_time.split(':').map(Number);
              
              let current = setMinutes(setHours(formData.date!, startH), startM);
              const shiftEnd = setMinutes(setHours(formData.date!, endH), endM);

              if (isSameDay(formData.date!, new Date()) && isBefore(current, new Date())) {
                  const now = new Date();
                  const remainder = 30 - (now.getMinutes() % 30);
                  current = addMinutes(now, remainder);
              }

              while (current < shiftEnd) {
                  let chainTime = current;
                  let isChainValid = true;

                  for (let i = 0; i < sequence.length; i++) {
                      const step = sequence[i];
                      const serviceEnd = addMinutes(chainTime, step.duration);

                      const hasShift = staffShifts.some((s: any) => 
                          String(s.staff_id) === String(step.staffId) && 
                          Number(s.weekday) === dbDay && 
                          String(s.location_id) === String(formData.location) &&
                          s.start_time <= format(chainTime, 'HH:mm:ss') && 
                          s.end_time >= format(serviceEnd, 'HH:mm:ss')
                      );

                      if (!hasShift) { 
                          isChainValid = false; 
                          break; 
                      }

                      const hasConflict = appointments.some((app: any) => {
                          if (app.status === 'cancelled') return false;
                          if (String(app.staff) !== String(step.staffId)) return false;
                          try {
                              const appStart = parseISO(app.start_time);
                              const appEnd = parseISO(app.end_time);
                              if (!isValid(appStart) || !isValid(appEnd)) return false;
                              return areIntervalsOverlapping({ start: chainTime, end: serviceEnd }, { start: appStart, end: appEnd });
                          } catch { return false; }
                      });

                      if (hasConflict) { 
                          isChainValid = false; 
                          break; 
                      }

                      chainTime = serviceEnd;
                  }

                  if (isChainValid) {
                      validSlots.add(format(current, 'HH:mm'));
                  }

                  current = addMinutes(current, 30);
              }
          });

          return Array.from(validSlots).sort();
      }

      // --- CASO AVULSO / PACOTE ---
      if (!formData.staff) return [];
      
      const shifts = staffShifts.filter((s: any) => 
          String(s.staff_id) === String(formData.staff) && 
          String(s.location_id) === String(formData.location) && 
          Number(s.weekday) === dbDay 
      );

      if (shifts.length === 0) return null; 

      let duration = 60;
      if (agendamentoType === 'avulso' && formData.service) {
          const srv = services.find((s:any) => s.id === formData.service);
          if (srv) duration = Number(srv.default_duration_min) || 30;
      } else if (agendamentoType === 'pacote' && formData.promotion) {
          const promo = promotions.find((p:any) => p.id === formData.promotion);
          if (promo?.items) {
             const firstItem = promo.items[0];
             const srv = services.find((s:any) => s.id === (firstItem.service || firstItem.service_id));
             duration = Number(srv?.default_duration_min) || 60;
          }
      }

      const slots: string[] = [];
      shifts.forEach((shift: any) => {
          const [startH, startM] = shift.start_time.split(':').map(Number);
          const [endH, endM] = shift.end_time.split(':').map(Number);
          let current = setMinutes(setHours(formData.date!, startH), startM);
          const endShift = setMinutes(setHours(formData.date!, endH), endM);

          let adjustedEndShift = endShift;
          if (endH < startH) {
              adjustedEndShift = addDays(endShift, 1);
          }

          if (isSameDay(formData.date!, new Date()) && isBefore(current, new Date())) {
              const now = new Date();
              const remainder = 30 - (now.getMinutes() % 30);
              current = addMinutes(now, remainder);
          }

          let iterations = 0;
          while (addMinutes(current, duration) <= adjustedEndShift && iterations < 50) {
              const slotEnd = addMinutes(current, duration);
              
              const hasConflict = appointments.some((app: any) => {
                  try {
                      if (app.status === 'cancelled') return false;
                      if (String(app.staff) !== String(formData.staff)) return false;
                      if (editingAppointment && app.id === editingAppointment.id) return false;
                      const appStart = parseISO(app.start_time);
                      const appEnd = parseISO(app.end_time);
                      if(!isValid(appStart) || !isValid(appEnd)) return false;
                      return areIntervalsOverlapping({ start: current, end: slotEnd }, { start: appStart, end: appEnd });
                  } catch { return false; }
              });

              if (!hasConflict) slots.push(format(current, 'HH:mm'));
              current = addMinutes(current, 30);
              iterations++;
          }
      });
      return Array.from(new Set(slots)).sort();

  }, [formData.date, formData.staff, formData.location, formData.service, formData.promotion, formData.staffMapping, staffShifts, appointments, services, promotions, agendamentoType, editingAppointment]);

  useEffect(() => {
    if (agendamentoType !== 'pacote' || !formData.promotion || !formData.date || !formData.staff || !formData.location) return;
    
    const promo = promotions.find((p:any) => p.id === formData.promotion);
    if (!promo) return;

    const totalSessions = promo.items.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0);
    const interval = promo.suggested_interval_days || 7;

    const sessions: { date: Date; valid: boolean }[] = [];
    let currentDate = formData.date;
    sessions.push({ date: currentDate, valid: true });

    for (let i = 1; i < totalSessions; i++) {
        let nextDate = addDays(currentDate, interval);
        let attempts = 0;
        while (isDateDisabledCheck(nextDate, formData.staff) && attempts < 60) { 
            nextDate = addDays(nextDate, 1);
            attempts++;
        }
        sessions.push({ date: nextDate, valid: true }); 
        currentDate = nextDate;
    }
    setFormData(prev => ({ ...prev, packageDates: sessions.map(s => s.date) }));
  }, [agendamentoType, formData.promotion, formData.date, formData.staff, formData.location]);


  const processedAppointments: ProcessedAppointment[] = useMemo(() => {
    return appointments.map((app: any) => {
        let start = new Date();
        let end = new Date();
        try {
            start = parseISO(app.start_time);
            end = parseISO(app.end_time);
            if (!isValid(start) || !isValid(end)) return null;
        } catch { return null; }

        return {
            id: app.id,
            title: `${app.customer_name} - ${app.service_name}`,
            start: start,
            end: end,
            resourceId: app.staff,
            status: app.status as AppointmentStatus,
            originalData: app,
            customerName: app.customer_name,
            serviceName: app.service_name,
            staffName: app.staff_name,
            startTime: start,
            endTime: end
        };
    }).filter(Boolean) as ProcessedAppointment[]; 
  }, [appointments]);

  const filteredAppointmentsList = useMemo(() => {
    return processedAppointments.filter(app => {
      const matchStaff = selectedStaffFilter === "all" || app.originalData.staff === selectedStaffFilter;
      const matchLocation = selectedLocationFilter === "all" || app.originalData.location === selectedLocationFilter;
      return matchStaff && matchLocation;
    });
  }, [processedAppointments, selectedStaffFilter, selectedLocationFilter]);

  const dailyAppointments = useMemo(() => {
    return filteredAppointmentsList
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
        locationName: locations.find((l:any) => l.id === app.originalData.location)?.name, 
        originalData: app.originalData
      }));
  }, [filteredAppointmentsList, selectedDate, locations]);

  const createMutation = useMutation({
    mutationFn: appointmentsAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: () => toast.error("Erro ao agendar.")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => appointmentsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setIsModalOpen(false);
      toast.success("Atualizado!");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: appointmentsAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setIsModalOpen(false);
      toast.success("Removido.");
    },
    onError: () => toast.error("Erro ao remover.")
  });

  const handleSave = async () => {
    if (!formData.customer || !formData.date || !formData.time || !formData.location) {
      toast.warning("Preencha todos os campos obrigatórios.");
      return;
    }

    if (agendamentoType === 'avulso' && !formData.staff) return toast.warning("Selecione o profissional.");
    
    if (!availableTimeSlots || (Array.isArray(availableTimeSlots) && availableTimeSlots.length === 0)) {
         toast.error("Nenhum horário disponível para esta data.");
         return;
    }
    
    if (Array.isArray(availableTimeSlots) && !availableTimeSlots.includes(formData.time) && !editingAppointment) {
         toast.error("Horário indisponível! Selecione outro.");
         return;
    }

    const [hours, minutes] = formData.time.split(':').map(Number);
    const startDateTime = setMinutes(setHours(formData.date, hours), minutes);

    const commonPayload = {
        customer: formData.customer === "new" ? undefined : formData.customer,
        customer_name: formData.customer === "new" ? formData.customerName : undefined,
        customer_phone: formData.customer === "new" ? formData.customerPhone : undefined,
        staff: formData.staff,
        location: formData.location,
        status: "confirmed"
    };

    if (agendamentoType === "avulso") {
        const srv = services.find((s:any) => s.id === formData.service);
        if(!srv) return;
        
        const endDateTime = addMinutes(startDateTime, Number(srv.default_duration_min) || 60);
        
        const payload = {
            ...commonPayload,
            service: formData.service,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            notes: formData.notes,
            final_amount_centavos: srv.price_centavos 
        };

        if (editingAppointment) {
            updateMutation.mutate({ id: editingAppointment.id, data: payload });
        } else {
            createMutation.mutate(payload, { onSuccess: () => { setIsModalOpen(false); toast.success("Agendamento criado!"); }});
        }
    } 
    // --- CORREÇÃO DO COMBO (PREÇO DIRETO) ---
    else if (agendamentoType === "combo") {
        const selectedPromo = promotions.find((p:any) => p.id === formData.promotion);
        if(!selectedPromo) return;
        
        if (!selectedPromo.items.every((_: any, idx: number) => !!formData.staffMapping[idx])) {
            toast.warning("Selecione o profissional para cada serviço.");
            return;
        }

        // 🔥 CORREÇÃO: Pega o preço já com desconto da promoção, SEM multiplicar novamente.
        const totalComboPrice = selectedPromo.price_centavos; 

        // Monta a sequência expandida
        const sequence: any[] = [];
        selectedPromo.items.forEach((item: any, idx: number) => {
            const srv = services.find((s:any) => s.id === (item.service || item.service_id));
            const staffId = formData.staffMapping[idx];
            if (srv && staffId) {
                for (let q = 0; q < (item.quantity || 1); q++) {
                    sequence.push({
                        service: srv,
                        staffId: staffId,
                        duration: Number(srv.default_duration_min) || 30
                    });
                }
            }
        });

        let currentStart = startDateTime;
        for (let i = 0; i < sequence.length; i++) {
            const step = sequence[i];
            const currentEnd = addMinutes(currentStart, step.duration);
            
            const itemNotes = i === 0 
                ? `[Combo: ${selectedPromo.title}] ${formData.notes}` 
                : `[Combo: ${selectedPromo.title} - Item ${i+1}] ${formData.notes}`;
            
            // Apenas a 1ª sessão recebe o valor total
            const itemPrice = i === 0 ? totalComboPrice : 0;

            await createMutation.mutateAsync({
                ...commonPayload,
                service: step.service.id,
                staff: step.staffId,
                start_time: currentStart.toISOString(),
                end_time: currentEnd.toISOString(),
                notes: itemNotes,
                final_amount_centavos: itemPrice 
            });
            currentStart = currentEnd;
        }
        setIsModalOpen(false);
        toast.success("Combo agendado com sucesso!");
    }
    // --- CORREÇÃO DO PACOTE (PREÇO DIRETO) ---
    else if (agendamentoType === "pacote") {
        const selectedPromo = promotions.find((p:any) => p.id === formData.promotion);
        if(!selectedPromo) return;
        
        const packageServiceSequence: any[] = [];
        selectedPromo.items.forEach((item: any) => {
             const srv = services.find((s:any) => s.id === (item.service || item.service_id));
             if (srv) {
                 for (let q = 0; q < item.quantity; q++) {
                     packageServiceSequence.push(srv);
                 }
             }
        });

        // 🔥 CORREÇÃO: Pega o preço já com desconto da promoção, SEM multiplicar novamente.
        const totalPackagePrice = selectedPromo.price_centavos;

        for (let i = 0; i < formData.packageDates.length; i++) {
            const currentService = packageServiceSequence[i] || packageServiceSequence[packageServiceSequence.length - 1];
            
            const sessionDate = formData.packageDates[i];
            const sessionStart = setMinutes(setHours(sessionDate, hours), minutes);
            const sessionEnd = addMinutes(sessionStart, Number(currentService.default_duration_min) || 60);
            
            const sessionNotes = `[Pacote: ${selectedPromo.title} - Sessão ${i+1}/${formData.packageDates.length} - ${currentService.name}] ${formData.notes}`;
            
            const sessionPrice = i === 0 ? totalPackagePrice : 0;

            await createMutation.mutateAsync({
                ...commonPayload,
                service: currentService.id, 
                start_time: sessionStart.toISOString(),
                end_time: sessionEnd.toISOString(),
                notes: sessionNotes,
                final_amount_centavos: sessionPrice
            });
        }
        setIsModalOpen(false);
        toast.success("Pacote recorrente agendado!");
    }
  };

  const handleNewAppointmentClick = () => {
    setEditingAppointment(null);
    setAgendamentoType("avulso");
    setFormData({
      customer: "", customerName: "", customerPhone: "",
      service: "", staff: "", location: selectedLocationFilter !== "all" ? selectedLocationFilter : "",
      promotion: "",
      date: undefined, 
      time: "", notes: "",
      staffMapping: {}, packageDates: []
    });
    setIsModalOpen(true);
  };

  const handleEditClick = (appData: any) => {
      const data = appData.originalData || appData;
      setEditingAppointment(data);
      setAgendamentoType("avulso"); 
      let startDate = new Date();
      try { startDate = parseISO(data.start_time); } catch (e) {}

      setFormData({
          customer: data.customer || "",
          customerName: "", customerPhone: "",
          service: data.service || "",
          staff: data.staff || "",
          location: data.location || "",
          promotion: "",
          date: startDate,
          time: isValid(startDate) ? format(startDate, "HH:mm") : "",
          notes: data.notes || "",
          staffMapping: {}, packageDates: []
      });
      setIsModalOpen(true);
  };

  const handleSmartCompletion = () => {
      if (!editingAppointment) return;
      const price = editingAppointment.final_amount_centavos || 0;
      
      if (price > 0 || (agendamentoType === 'avulso' && !editingAppointment.notes?.includes('[Pacote') && !editingAppointment.notes?.includes('[Combo'))) {
          setIsModalOpen(false);
          setAppointmentToPay(editingAppointment);
          setPaymentModalOpen(true);
      } else {
          if (confirm("Este item não possui valor a receber. Deseja concluir a sessão?")) {
              updateMutation.mutate({ id: editingAppointment.id, data: { status: 'completed' } });
          }
      }
  };

  const handleStatusChange = (status: string) => {
      if(status === 'cancelled') {
         const notes = editingAppointment?.notes || "";
         if (notes.includes("[Pacote:")) {
             const match = notes.match(/Sessão (\d+)\//);
             if (match) {
                 const sessionNum = parseInt(match[1]);
                 if (sessionNum > 1) {
                     toast.warning("Pacotes em andamento não podem ser cancelados.");
                     return;
                 }
                 if (sessionNum === 1) {
                     if (!confirm("Ao cancelar a 1ª sessão, TODAS as sessões futuras serão canceladas.")) return;
                 }
             }
         }
      }
      if(status === 'completed') {
          handleSmartCompletion();
      } else {
          updateMutation.mutate({ id: editingAppointment.id, data: { status } });
      }
  };

  const handleDeleteAppointment = (id: string) => {
      if (confirm("ATENÇÃO: Deseja realmente excluir este agendamento?")) deleteMutation.mutate(id);
  };

  const handleStaffSelect = (idx: number, staffId: string) => {
      setFormData(f => ({ ...f, staffMapping: { ...f.staffMapping, [idx]: staffId }, time: '' }));
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in bg-stone-50/50 dark:bg-stone-950 min-h-screen font-sans">
      
      {/* HEADER */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-stone-900 rounded-lg shadow-sm border border-stone-100 dark:border-stone-800">
               <CalendarIcon className="w-5 h-5 text-[#C6A87C]" />
            </div>
            Agenda
          </h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm mt-1 ml-1">Gerencie atendimentos e disponibilidade.</p>
        </div>
        <div className="w-full xl:w-auto flex flex-col md:flex-row gap-3 bg-white dark:bg-stone-900 p-2 rounded-xl border border-stone-100 shadow-sm">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal min-w-[140px]">
                <CalendarIcon className="mr-2 h-4 w-4 text-[#C6A87C]" />
                {selectedDate ? format(selectedDate, "dd/MM/yyyy") : <span>Data</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} initialFocus /></PopoverContent>
          </Popover>
          <div className="flex gap-2 flex-1 md:flex-none">
             <Select value={selectedLocationFilter} onValueChange={setSelectedLocationFilter}><SelectTrigger className="w-full md:w-[140px]"><SelectValue placeholder="Unidade" /></SelectTrigger><SelectContent><SelectItem value="all">Todas Unidades</SelectItem>{locations.map((loc: any) => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}</SelectContent></Select>
             <Select value={selectedStaffFilter} onValueChange={setSelectedStaffFilter}><SelectTrigger className="w-full md:w-[140px]"><SelectValue placeholder="Profissional" /></SelectTrigger><SelectContent><SelectItem value="all">Todos Prof.</SelectItem>{staffList.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
              <div className="flex bg-stone-100 dark:bg-stone-800 p-1 rounded-lg">
                <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-stone-700 text-[#C6A87C] shadow-sm' : 'text-stone-400'}`} onClick={() => setViewMode("list")}><List className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-md transition-all ${viewMode === 'calendar' ? 'bg-white dark:bg-stone-700 text-[#C6A87C] shadow-sm' : 'text-stone-400'}`} onClick={() => setViewMode("calendar")}><CalendarIcon className="h-4 w-4" /></Button>
              </div>
              <Button onClick={handleNewAppointmentClick} className="flex-1 md:flex-none bg-[#C6A87C] hover:bg-[#B08D55] text-white shadow-sm transition-all font-medium px-6"><Plus className="w-4 h-4 mr-2" /> Novo</Button>
          </div>
        </div>
      </div>

      {/* BODY */}
      {isLoading ? <div className="py-20 text-center text-stone-400">Carregando...</div> : (
        <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-100 shadow-sm overflow-hidden min-h-[500px]">
            {viewMode === 'list' ? (
                <div className="p-4 md:p-6 space-y-4">
                    <div className="flex items-center justify-between border-b pb-4"><div className="flex items-center gap-3"><div className="text-3xl font-bold text-stone-800">{format(selectedDate, "dd")}</div><div className="flex flex-col"><span className="text-sm font-medium uppercase text-stone-500">{format(selectedDate, "MMMM", { locale: ptBR })}</span><span className="text-xs text-stone-400 capitalize">{format(selectedDate, "EEEE", { locale: ptBR })}</span></div></div><Badge variant="secondary">{dailyAppointments.length} agendamentos</Badge></div>
                    <div className="space-y-3">
                        {dailyAppointments.length > 0 ? dailyAppointments.map((app: any) => (
                            <AppointmentCard 
                                key={app.id} 
                                {...app} 
                                onClick={() => handleEditClick(app)} 
                            />
                        )) : <div className="text-center py-16 text-stone-400"><Clock className="w-8 h-8 mx-auto mb-2 opacity-20" /><p>Dia livre.</p></div>}
                    </div>
                </div>
            ) : (
                <div className="p-2 h-full"><CalendarView appointments={processedAppointments} onAppointmentClick={handleEditClick} onDateClick={(d) => { setSelectedDate(d); setViewMode("list"); }} /></div>
            )}
        </div>
      )}

      {/* --- MODAL NOVO AGENDAMENTO --- */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>{editingAppointment ? "Editar Agendamento" : "Novo Agendamento"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                
                {!editingAppointment && (
                    <Tabs value={agendamentoType} onValueChange={(v:any) => { setAgendamentoType(v); setFormData(f => ({...f, promotion: '', service: '', staffMapping: {}, staff: '', packageDates: []})); }} className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="avulso"><Clock className="w-3 h-3 mr-2"/> Avulso</TabsTrigger>
                            <TabsTrigger value="combo"><Sparkles className="w-3 h-3 mr-2"/> Combo</TabsTrigger>
                            <TabsTrigger value="pacote"><Repeat className="w-3 h-3 mr-2"/> Pacote</TabsTrigger>
                        </TabsList>
                    </Tabs>
                )}

                <div className="space-y-1">
                    <Label className="text-xs font-bold text-stone-500 uppercase">Unidade</Label>
                    <Select value={formData.location} onValueChange={(v) => setFormData({...formData, location: v, staff: ''})} disabled={!!editingAppointment}>
                        <SelectTrigger className="bg-stone-50 border-stone-200"><SelectValue placeholder="Selecione a unidade primeiro" /></SelectTrigger>
                        <SelectContent>{locations.map((l:any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>

                {agendamentoType === 'avulso' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label className="text-xs font-bold text-stone-500 uppercase">Serviço</Label>
                            <Select value={formData.service} onValueChange={(v) => setFormData({...formData, service: v, staff: ''})}>
                                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                <SelectContent>{services.map((s:any) => <SelectItem key={s.id} value={s.id}>{s.name} - R${(s.price_centavos/100).toFixed(2)}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-bold text-stone-500 uppercase">Profissional</Label>
                            <Select value={formData.staff} onValueChange={(v) => setFormData({...formData, staff: v})} disabled={!formData.location}>
                                <SelectTrigger><SelectValue placeholder={!formData.location ? "Escolha a unidade" : "Selecione..."} /></SelectTrigger>
                                <SelectContent>{availableStaffSimple.map((s:any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                )}

                {/* ABA 2: COMBO (MULTI-PROFISSIONAL) */}
                {agendamentoType === 'combo' && (
                    <div className="space-y-4 border p-4 rounded-xl bg-stone-50/50">
                        <div className="space-y-1">
                            <Label className="text-[#C6A87C] text-xs uppercase tracking-wider font-bold flex items-center gap-1">
                                <Sparkles className="w-3 h-3"/> Combo Promocional
                            </Label>
                            <Select value={formData.promotion} onValueChange={(v) => setFormData({...formData, promotion: v, staffMapping: {}})}>
                                <SelectTrigger className="bg-white border-[#C6A87C]/30"><SelectValue placeholder="Escolha a promoção..." /></SelectTrigger>
                                <SelectContent>
                                    {promotions.filter((p:any) => p.type === 'combo').map((p:any) => (
                                        <SelectItem key={p.id} value={p.id}>{p.title} (R$ {(p.price_centavos/100).toFixed(2)})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        {formData.promotion && (
                            <div className="space-y-3 mt-2">
                                <p className="text-[10px] font-bold text-stone-400 uppercase">Selecione os profissionais</p>
                                {promotions.find((p:any) => p.id === formData.promotion)?.items.map((item: any, idx: number) => {
                                    const serviceName = services.find((s:any) => s.id === (item.service || item.service_id))?.name || "Serviço";
                                    const staffOptions = getQualifiedStaff(item.service || item.service_id);
                                    
                                    return (
                                        <div key={idx} className="grid grid-cols-2 gap-2 items-center bg-white p-2 rounded border border-stone-100">
                                            <span className="text-xs font-medium text-stone-700 truncate" title={serviceName}>
                                                {idx+1}. {serviceName}
                                            </span>
                                            <Select value={formData.staffMapping[idx] || ''} onValueChange={(v) => handleStaffSelect(idx, v)}>
                                                <SelectTrigger className="h-8 text-xs border-stone-200"><SelectValue placeholder="Quem fará?" /></SelectTrigger>
                                                <SelectContent>
                                                    {staffOptions.map((s:any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ABA 3: PACOTE */}
                {agendamentoType === 'pacote' && (
                    <div className="space-y-4 border p-4 rounded-xl bg-stone-50/50">
                        <div className="space-y-1">
                            <Label className="text-[#C6A87C] text-xs uppercase tracking-wider font-bold flex items-center gap-1">
                                <Package className="w-3 h-3"/> Pacote Recorrente
                            </Label>
                            <Select value={formData.promotion} onValueChange={(v) => setFormData({...formData, promotion: v, packageDates: []})}>
                                <SelectTrigger className="bg-white border-[#C6A87C]/30"><SelectValue placeholder="Escolha a promoção..." /></SelectTrigger>
                                <SelectContent>
                                    {promotions.filter((p:any) => p.type === 'package').map((p:any) => (
                                        <SelectItem key={p.id} value={p.id}>{p.title} (R$ {(p.price_centavos/100).toFixed(2)})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-bold text-stone-500 uppercase">Profissional Responsável</Label>
                            <Select value={formData.staff} onValueChange={(v) => setFormData({...formData, staff: v})} disabled={!formData.location}>
                                <SelectTrigger className="bg-white"><SelectValue placeholder="Quem vai atender?" /></SelectTrigger>
                                <SelectContent>{availableStaffSimple.map((s:any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        
                        {/* PREVISÃO DE PACOTE (EDITÁVEL) */}
                        {formData.promotion && formData.date && formData.packageDates.length > 0 && (
                            <div className="bg-white border border-stone-200 rounded-lg p-3 mt-2">
                                <p className="text-xs font-bold text-stone-500 uppercase mb-2 flex items-center gap-2">
                                   <CalendarDays className="w-3 h-3"/> Datas das Sessões (Editável)
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[150px] overflow-y-auto pr-1">
                                    {formData.packageDates.map((date, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-xs bg-stone-50 p-1 rounded border border-stone-100">
                                            <span className="font-bold text-[#C6A87C] w-5 text-center">{idx + 1}ª</span>
                                            {/* Input para trocar data se necessário */}
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-6 w-full justify-start px-2 text-xs font-normal">
                                                        {format(date, "dd/MM/yy (EEE)", { locale: ptBR })}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0">
                                                    <Calendar 
                                                        mode="single" 
                                                        selected={date} 
                                                        onSelect={(d) => {
                                                            if (!d) return;
                                                            // Atualiza apenas a data desta sessão
                                                            const newDates = [...formData.packageDates];
                                                            newDates[idx] = d;
                                                            setFormData(f => ({...f, packageDates: newDates}));
                                                        }} 
                                                        disabled={(d) => isDateDisabledCheck(d, formData.staff)}
                                                        initialFocus 
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            {isDateDisabledCheck(date, formData.staff) && (
                                                <span title="Dia indisponível" className="ml-auto cursor-help">
                                                    <AlertCircle className="w-3 h-3 text-red-500" />
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-1">
                    <Label className="text-xs font-bold text-stone-500 uppercase">Cliente</Label>
                    <Select value={formData.customer} onValueChange={(v) => setFormData({...formData, customer: v})} disabled={!!editingAppointment}>
                        <SelectTrigger className="bg-stone-50 border-stone-200"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="new" className="text-[#C6A87C] font-bold">+ Novo Cliente</SelectItem>
                            {customers.map((c:any) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                {formData.customer === 'new' && (
                    <div className="grid grid-cols-2 gap-4 p-3 bg-stone-100 rounded-lg">
                        <Input placeholder="Nome" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} className="bg-white" />
                        <Input placeholder="WhatsApp" value={formData.customerPhone} onChange={e => setFormData({...formData, customerPhone: e.target.value})} className="bg-white" />
                    </div>
                )}

                {/* 4. DATA E HORA (COM LISTA SUSPENSA DE HORÁRIOS) */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label className="text-xs font-bold text-stone-500 uppercase">Data de Início</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className={`w-full justify-start text-left font-normal ${!formData.staff && agendamentoType !== 'combo' || !formData.location ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={(!formData.staff && agendamentoType !== 'combo') || !formData.location}>
                                    <CalendarIcon className="mr-2 h-4 w-4 text-stone-400" />
                                    {formData.date ? format(formData.date, "dd/MM/yyyy") : <span>Selecione</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar 
                                    mode="single" 
                                    selected={formData.date} 
                                    onSelect={(d) => d && setFormData({...formData, date: d, time: ''})} // Reseta hora
                                    disabled={isDateDisabled} 
                                    initialFocus 
                                />
                                {(!formData.staff && agendamentoType !== 'combo') && <p className="p-2 text-xs text-red-500 text-center">Selecione o profissional primeiro.</p>}
                            </PopoverContent>
                        </Popover>
                    </div>
                    
                    {/* 🔥 LISTA SUSPENSA DE HORÁRIOS DISPONÍVEIS */}
                    <div className="space-y-1">
                        <Label className="text-xs font-bold text-stone-500 uppercase">Horário</Label>
                        <Select value={formData.time} onValueChange={(v) => setFormData({...formData, time: v})} disabled={!formData.date || (!availableTimeSlots && !editingAppointment)}>
                            <SelectTrigger className="bg-stone-50 border-stone-200">
                                <SelectValue placeholder={
                                    availableTimeSlots === null 
                                    ? "Sem turno neste dia" 
                                    : (availableTimeSlots.length === 0 ? "Agenda cheia" : "Selecione...")
                                } />
                            </SelectTrigger>
                            <SelectContent>
                                {availableTimeSlots && availableTimeSlots.length > 0 ? (
                                    availableTimeSlots.map((time) => (
                                        <SelectItem key={time} value={time}>{time}</SelectItem>
                                    ))
                                ) : (
                                    <SelectItem value="none" disabled>
                                        {availableTimeSlots === null ? "Profissional não trabalha neste dia/unidade" : "Agenda cheia"}
                                    </SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-1">
                    <Label className="text-xs font-bold text-stone-500 uppercase">Observações</Label>
                    <Textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="resize-none h-20 bg-stone-50 border-stone-200" />
                </div>

                {/* BOTÕES DE STATUS (EDIÇÃO) */}
                {editingAppointment && (
                    <div className="flex gap-2 pt-2 border-t mt-2">
                        {/* Se pendente, confirma. Se não, permite mudar. */}
                        {editingAppointment.status === 'pending' ? (
                            <Button size="sm" variant="outline" className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => handleStatusChange('confirmed')}>Confirmar Agendamento</Button>
                        ) : (
                            <Button size="sm" variant="outline" className="flex-1 text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleStatusChange('cancelled')}>Cancelar</Button>
                        )}
                        
                        {/* Botão Inteligente: Pagar ou Concluir */}
                        <Button 
                            size="sm" 
                            variant="outline" 
                            className="flex-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 font-bold" 
                            onClick={() => handleStatusChange('completed')}
                        >
                            {(editingAppointment.final_amount_centavos || 0) > 0 || !editingAppointment.notes?.includes('[') ? (
                                <><Wallet className="w-3 h-3 mr-2"/> Receber & Concluir</>
                            ) : (
                                <><CheckCircle2 className="w-3 h-3 mr-2"/> Concluir Sessão</>
                            )}
                        </Button>
                    </div>
                )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
                {editingAppointment && <Button variant="ghost" onClick={() => handleDeleteAppointment(editingAppointment.id)} className="text-red-500 hover:bg-red-50 sm:mr-auto"><Trash2 className="w-4 h-4 mr-2"/> Excluir</Button>}
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} className="bg-[#C6A87C] hover:bg-[#B08D55] text-white font-bold shadow-md">
                    {createMutation.isPending ? "Salvando..." : "Salvar Agendamento"}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {appointmentToPay && <PaymentConfirmationModal isOpen={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} onConfirm={() => { setPaymentModalOpen(false); updateMutation.mutate({ id: appointmentToPay.id, data: { status: 'completed' } }); }} appointment={appointmentToPay} />}
    </div>
  );
}
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isSameDay, addMinutes, setHours, setMinutes, isPast, getDay, startOfMonth, endOfMonth, eachDayOfInterval, endOfDay } from "date-fns"; 
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { appointmentsAPI, servicesAPI, staffAPI, staffShiftsAPI, staffServicesAPI, locationsAPI, customersAPI } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Check, Scissors, User, Clock, MapPin, CalendarCheck, Sparkles, ArrowRight } from "lucide-react";

// --- INTERFACES E TIPOS ---
interface Service { id: string; name: string; price_centavos: number; default_duration_min: number; }
interface Staff { id: string; name: string; }
interface Location { id: string; name: string; }
interface StaffShift { staff_id: string; location_id: string; weekday: number; start_time: string; end_time: string; }
interface StaffService { staff_id: string; service_id: string; }
interface Appointment { id: string; staff: string; start_time: string; end_time: string; status: 'confirmed' | 'pending'; }

// ----------------------------------------------------
// FUNÇÕES AUXILIARES DE TELEFONE
// ----------------------------------------------------
const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    let coreNumber = numbers;
    if (numbers.startsWith("55") && numbers.length > 11) {
        coreNumber = numbers.substring(2);
    }
    coreNumber = coreNumber.slice(0, 11);
    if (coreNumber.length === 0) return "";
    let formatted = "+55";
    if (coreNumber.length > 0) formatted += ` (${coreNumber.substring(0, 2)}`;
    if (coreNumber.length > 2) formatted += `) ${coreNumber.substring(2, 7)}`;
    if (coreNumber.length > 7) formatted += `-${coreNumber.substring(7, 11)}`;
    return formatted;
};

const getRawPhone = (formatted: string) => {
    const nums = formatted.replace(/\D/g, "");
    if (nums.startsWith("55")) return nums;
    return `55${nums}`;
};

// ----------------------------------------------------
// COMPONENTE PRINCIPAL
// ----------------------------------------------------

export default function AgendamentoCliente() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  
  const [formData, setFormData] = useState({
    selectedServiceIds: [] as string[], 
    serviceStaffMapping: {} as Record<string, string>, 
    locationId: '', 
    date: new Date(), 
    time: '',
    customerName: '', 
    customerPhone: '', 
    customerEmail: ''
  });

  // Queries
  const { data: services = [] } = useQuery<Service[]>({ queryKey: ['services'], queryFn: servicesAPI.getAll });
  const { data: allStaff = [] } = useQuery<Staff[]>({ queryKey: ['staff'], queryFn: staffAPI.getAll });
  const { data: staffServices = [] } = useQuery<StaffService[]>({ queryKey: ['staffServices'], queryFn: staffServicesAPI.getAll });
  const { data: staffShifts = [] } = useQuery<StaffShift[]>({ queryKey: ['staffShifts'], queryFn: staffShiftsAPI.getAll });
  const { data: allAppointments = [] } = useQuery<Appointment[]>({ queryKey: ['appointments'], queryFn: appointmentsAPI.getAll }); 
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ['locations'], queryFn: locationsAPI.getAll });

  // Computados
  const selectedServices = useMemo(() => 
    services.filter(s => formData.selectedServiceIds.includes(s.id)), 
    [formData.selectedServiceIds, services]
  );
  
  const orderedServices = useMemo(() => {
      return formData.selectedServiceIds.map(id => services.find(s => s.id === id)!).filter(Boolean);
  }, [formData.selectedServiceIds, services]);

  const totalDuration = useMemo(() => 
    selectedServices.reduce((sum, s) => sum + (s.default_duration_min || 0), 0), 
    [selectedServices]
  );
  
  const totalPrice = useMemo(() => 
    selectedServices.reduce((sum, s) => sum + (s.price_centavos || 0), 0), 
    [selectedServices]
  );
  const formattedPrice = (totalPrice / 100).toFixed(2).replace('.', ',');
  const selectedLocation = useMemo(() => locations.find(l => l.id === formData.locationId), [formData.locationId, locations]);

  // Handlers
  const handleServiceToggle = (serviceId: string) => {
    setFormData(f => {
        const currentIds = f.selectedServiceIds;
        const isSelected = currentIds.includes(serviceId);
        const newIds = isSelected ? currentIds.filter(id => id !== serviceId) : [...currentIds, serviceId];
        
        const newMapping = { ...f.serviceStaffMapping };
        if (isSelected) delete newMapping[serviceId];

        return { ...f, selectedServiceIds: newIds, serviceStaffMapping: newMapping, time: '' };
    });
  };

  const handleStaffSelect = (serviceId: string, staffId: string) => {
      setFormData(f => ({
          ...f,
          serviceStaffMapping: { ...f.serviceStaffMapping, [serviceId]: staffId },
          time: ''
      }));
  };

  const getStaffForService = (serviceId: string) => {
      if (!formData.locationId) return [];
      const staffWhoDoService = staffServices.filter(ss => ss.service_id === serviceId).map(ss => ss.staff_id);
      const staffAtLocation = new Set(staffShifts.filter(s => s.location_id === formData.locationId).map(s => s.staff_id));
      return allStaff.filter(s => staffWhoDoService.includes(s.id) && staffAtLocation.has(s.id));
  };

  // LÓGICA DE DISPONIBILIDADE SEQUENCIAL (CASCATA)
  const availableSlots = useMemo(() => {
      if (orderedServices.length === 0 || !formData.date || !formData.locationId) return [];
      if (Object.keys(formData.serviceStaffMapping).length < orderedServices.length) return [];

      const dayOfWeek = getDay(formData.date);
      
      const firstService = orderedServices[0];
      const firstStaffId = formData.serviceStaffMapping[firstService.id];
      const firstStaffShifts = staffShifts.filter(s => s.staff_id === firstStaffId && s.weekday === dayOfWeek && s.location_id === formData.locationId);
      
      const validStartTimes = new Set<string>();

      firstStaffShifts.forEach(shift => {
          const [sh, sm] = shift.start_time.split(':').map(Number);
          const [eh, em] = shift.end_time.split(':').map(Number);
          let current = setMinutes(setHours(formData.date, sh), sm);
          const shiftEnd = setMinutes(setHours(formData.date, eh), em);

          const now = new Date();
          if (isSameDay(current, now) && current < now) {
             const minutesNow = now.getHours() * 60 + now.getMinutes();
             const blocks = Math.ceil((minutesNow - (sh * 60 + sm)) / 30);
             current = addMinutes(current, blocks * 30);
          }

          while (current < shiftEnd) {
              let isValidChain = true;
              let chainPointer = current;

              for (const srv of orderedServices) {
                  const srvStaffId = formData.serviceStaffMapping[srv.id];
                  const srvDur = srv.default_duration_min || 30;
                  const srvEnd = addMinutes(chainPointer, srvDur);

                  const staffHasShift = staffShifts.some(s => 
                      s.staff_id === srvStaffId && 
                      s.weekday === dayOfWeek && 
                      s.location_id === formData.locationId &&
                      s.start_time <= format(chainPointer, 'HH:mm:ss') &&
                      s.end_time >= format(srvEnd, 'HH:mm:ss')
                  );

                  if (!staffHasShift) { isValidChain = false; break; }

                  const conflict = allAppointments.some(a => 
                      a.staff === srvStaffId && 
                      isSameDay(new Date(a.start_time), formData.date) &&
                      (
                          (chainPointer >= new Date(a.start_time) && chainPointer < new Date(a.end_time)) ||
                          (srvEnd > new Date(a.start_time) && srvEnd <= new Date(a.end_time)) ||
                          (chainPointer <= new Date(a.start_time) && srvEnd >= new Date(a.end_time))
                      )
                  );

                  if (conflict) { isValidChain = false; break; }

                  chainPointer = srvEnd;
              }

              if (isValidChain) {
                  validStartTimes.add(format(current, 'HH:mm'));
              }
              current = addMinutes(current, 30);
          }
      });
      
      return Array.from(validStartTimes).sort();
  }, [formData, staffShifts, allAppointments, orderedServices]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value.replace(/\D/g, "");
      if (val.length > 11) val = val.slice(0, 11);
      let formatted = val;
      if (val.length > 2) formatted = `(${val.slice(0,2)}) ${val.slice(2)}`;
      if (val.length > 7) formatted = `(${val.slice(0,2)}) ${val.slice(2,7)}-${val.slice(7)}`;
      setFormData(f => ({...f, customerPhone: formatted}));
  };

  const handlePhoneBlur = async () => {
      const raw = getRawPhone(formData.customerPhone);
      if (raw.length < 12) return; 
      setIsCheckingPhone(true);
      try {
          const response = await customersAPI.checkPhone(raw);
          if (response.exists) {
              setFormData(f => ({
                  ...f,
                  customerName: response.name,
                  customerEmail: response.email || f.customerEmail
              }));
              toast.info(`Bem-vinda de volta, ${response.name.split(' ')[0]}!`);
          }
      } catch (error) {
          console.error("Erro ao verificar telefone", error);
      } finally {
          setIsCheckingPhone(false);
      }
  };

  const createAppointmentMutation = useMutation({
    mutationFn: (payload: any) => appointmentsAPI.create(payload),
    onSuccess: () => {
        toast.success("Solicitação de agendamento enviada!", {
            description: "Verifique seu WhatsApp para o pagamento do sinal."
        });
        setStep(5);
        queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao agendar.")
  });

  const handleFinalize = () => {
      const [h, m] = formData.time.split(':').map(Number);
      const start = setMinutes(setHours(formData.date, h), m);
      
      const items = orderedServices.map(s => ({
          service: s.id,
          staff: formData.serviceStaffMapping[s.id]
      }));

      const rawNumbers = formData.customerPhone.replace(/\D/g, "");
      const fullPhone = `55${rawNumbers}`;

      createAppointmentMutation.mutate({
          customer_name: formData.customerName,
          customer_phone: fullPhone, 
          customer_email: formData.customerEmail,
          location: formData.locationId,
          start_time: start.toISOString(),
          items: items
      });
  };

  const handleNextStep = () => {
      if (step === 1) {
          if (formData.selectedServiceIds.length === 0) {
              toast.error("Selecione pelo menos um serviço.");
              return;
          }
          setStep(2);
      } 
      else if (step === 2) {
          if (!formData.locationId) {
              toast.error("Selecione a unidade de atendimento.");
              return;
          }
          const allServicesHaveStaff = formData.selectedServiceIds.every(sId => formData.serviceStaffMapping[sId]);
          if (!allServicesHaveStaff) {
              toast.error("Selecione um profissional para cada serviço.");
              return;
          }
          if (!formData.date) {
              toast.error("Selecione uma data.");
              return;
          }
          setStep(3);
      }
      else if (step === 3) {
          if (!formData.time) {
              toast.error("Selecione um horário.");
              return;
          }
          setStep(4);
      }
  };

  // --- RENDERIZAÇÃO ---
  const renderStepContent = () => {
      const renderBold = (text: string | undefined) => <span className="font-semibold">{text || 'N/A'}</span>;
      
      switch(step) {
          case 1:
            return (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <Scissors className="w-5 h-5 text-primary" /> Selecione os Serviços
                        </h2>
                        {formData.selectedServiceIds.length > 0 && (
                            <Badge variant="secondary">{formData.selectedServiceIds.length} selecionado(s)</Badge>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {services.map(s => (
                            <Card key={s.id} 
                                className={`p-4 cursor-pointer relative transition-all duration-200 ${
                                    formData.selectedServiceIds.includes(s.id) 
                                    ? 'border-primary border-2 bg-primary/5 shadow-sm' 
                                    : 'border hover:border-primary/50'
                                }`}
                                onClick={() => handleServiceToggle(s.id)}>
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-semibold pr-6">{s.name}</h3>
                                    {formData.selectedServiceIds.includes(s.id) && (
                                        <div className="bg-primary text-primary-foreground rounded-full p-0.5 absolute top-3 right-3">
                                            <Check className="w-3 h-3" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-between items-center text-sm text-muted-foreground">
                                    <span>{s.default_duration_min} min</span>
                                    <span className="font-medium text-foreground">R$ {(s.price_centavos/100).toFixed(2).replace('.', ',')}</span>
                                </div>
                            </Card>
                        ))}
                    </div>
                    
                    {formData.selectedServiceIds.length > 0 && (
                        <Alert className="bg-muted/50 border-none">
                            <div className="flex justify-between items-center w-full">
                                <div className="text-sm">
                                    <span className="text-muted-foreground">Total Estimado: </span>
                                    <span className="font-semibold text-foreground">R$ {formattedPrice}</span>
                                </div>
                                <div className="text-sm">
                                    <span className="text-muted-foreground">Duração: </span>
                                    <span className="font-semibold text-foreground">{totalDuration} min</span>
                                </div>
                            </div>
                        </Alert>
                    )}
                </div>
            );

          case 2:
            return (
                <div className="space-y-6">
                     <h2 className="text-xl font-semibold flex items-center gap-2">
                        <User className="w-5 h-5 text-primary" /> Profissionais e Data
                     </h2>
                     
                     <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <Label>Unidade de Atendimento</Label>
                                <Select value={formData.locationId} onValueChange={v => setFormData(f => ({...f, locationId: v, serviceStaffMapping: {}, time: ''}))}>
                                    <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                                    <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>

                            {formData.locationId && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">Quem vai te atender?</Label>
                                    {orderedServices.map(service => {
                                        const staffList = getStaffForService(service.id);
                                        return (
                                            <div key={service.id} className="space-y-1.5">
                                                <Label className="text-sm font-medium">{service.name}</Label>
                                                <Select 
                                                   value={formData.serviceStaffMapping[service.id] || ''} 
                                                   onValueChange={v => handleStaffSelect(service.id, v)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Escolha o profissional" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {staffList.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                                {staffList.length === 0 && <p className="text-xs text-red-500">Sem profissionais disponíveis nesta unidade.</p>}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-center items-start">
                            {Object.keys(formData.serviceStaffMapping).length === formData.selectedServiceIds.length && formData.selectedServiceIds.length > 0 ? (
                                <div className="border rounded-lg p-4 shadow-sm animate-in zoom-in-95">
                                    <Calendar 
                                        mode="single" 
                                        selected={formData.date} 
                                        onSelect={d => d && setFormData(f => ({...f, date: d, time: ''}))} 
                                        locale={ptBR} 
                                        disabled={d => isPast(d) && !isSameDay(d, new Date())} 
                                        className="rounded-md border-none"
                                    />
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center text-center p-6 border-2 border-dashed rounded-lg text-muted-foreground bg-muted/10">
                                    <p className="text-sm">Selecione a unidade e os profissionais para ver o calendário.</p>
                                </div>
                            )}
                        </div>
                     </div>
                </div>
            );

          case 3:
             return (
                 <div className="space-y-6">
                     <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Clock className="w-5 h-5 text-primary" /> Horários Disponíveis
                     </h2>
                     <Alert>
                         <AlertDescription>
                             Os horários abaixo consideram a duração total dos serviços em sequência.
                         </AlertDescription>
                     </Alert>
                     <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                         {availableSlots.map(slot => (
                             <Button 
                                key={slot} 
                                variant={formData.time === slot ? 'default' : 'outline'} 
                                onClick={() => setFormData(f => ({...f, time: slot}))}
                                className="w-full"
                             >
                                 {slot}
                             </Button>
                         ))}
                     </div>
                     {availableSlots.length === 0 && (
                         <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg">
                             <p>Não há sequência de horários disponível para esses profissionais.</p>
                             <Button variant="ghost" onClick={() => setStep(2)}>Tentar outra data</Button>
                         </div>
                     )}
                 </div>
             );

          case 4:
             return (
                 <div className="space-y-6">
                     <h2 className="text-xl font-semibold flex items-center gap-2">
                        <CalendarCheck className="w-5 h-5 text-primary" /> Confirmar Agendamento
                     </h2>
                     
                     <Card className="overflow-hidden border-2">
                         <div className="bg-muted/40 p-4 border-b flex justify-between items-center">
                             <div className="flex items-center gap-2">
                                 <MapPin className="w-4 h-4 text-muted-foreground" />
                                 <span className="font-medium">{selectedLocation?.name}</span>
                             </div>
                             <Badge variant="outline" className="bg-background">
                                {format(formData.date, "dd 'de' MMMM", { locale: ptBR })} às {formData.time}
                             </Badge>
                         </div>

                         <div className="p-6 space-y-6">
                             <div className="space-y-3">
                                 <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Serviços em Sequência</h3>
                                 <div className="divide-y">
                                     {orderedServices.map((s, idx) => {
                                         const staffName = allStaff.find(st => st.id === formData.serviceStaffMapping[s.id])?.name;
                                         return (
                                             <div key={s.id} className="py-3 flex justify-between items-center first:pt-0 last:pb-0">
                                                 <div>
                                                     <div className="flex items-center gap-2">
                                                         <Badge variant="outline" className="h-5 w-5 flex items-center justify-center p-0 text-xs">{idx + 1}</Badge>
                                                         <p className="font-medium text-base">{s.name}</p>
                                                     </div>
                                                     <p className="text-sm text-muted-foreground flex items-center gap-1 ml-7">
                                                        <User className="w-3 h-3" /> {staffName}
                                                     </p>
                                                 </div>
                                                 <div className="text-right">
                                                     <p className="font-medium text-sm">{s.default_duration_min} min</p>
                                                     <p className="text-sm text-muted-foreground">R$ {(s.price_centavos/100).toFixed(2).replace('.', ',')}</p>
                                                 </div>
                                             </div>
                                         )
                                     })}
                                 </div>
                             </div>

                             <Separator />

                             <div className="flex justify-between items-end">
                                 <div>
                                     <p className="text-sm text-muted-foreground mb-1">Tempo Total Estimado</p>
                                     <div className="flex items-baseline gap-1">
                                         <Clock className="w-4 h-4 text-primary" />
                                         <span className="text-xl font-bold">{totalDuration}</span>
                                         <span className="text-sm font-medium text-muted-foreground">minutos</span>
                                     </div>
                                 </div>
                                 <div className="text-right">
                                     <p className="text-sm text-muted-foreground mb-1">Valor Total</p>
                                     <p className="text-2xl font-bold text-primary">R$ {formattedPrice}</p>
                                 </div>
                             </div>
                         </div>
                     </Card>

                     <div className="grid gap-4 pt-2">
                         <div className="space-y-2">
                             <Label htmlFor="phone">WhatsApp</Label>
                             <div className="relative flex items-center">
                                 <div className="absolute left-3 text-muted-foreground text-sm font-medium">+55</div>
                                 <Input 
                                    id="phone" 
                                    placeholder="(11) 99999-9999" 
                                    value={formData.customerPhone} 
                                    onChange={handlePhoneChange} 
                                    onBlur={handlePhoneBlur} 
                                    disabled={isCheckingPhone}
                                    className="pl-12"
                                 />
                                 {isCheckingPhone && (
                                     <div className="absolute right-3">
                                         <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                     </div>
                                 )}
                             </div>
                         </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nome Completo</Label>
                                <Input id="name" placeholder="Digite seu nome" value={formData.customerName} onChange={e => setFormData(f => ({...f, customerName: e.target.value}))} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">E-mail (Opcional)</Label>
                                <Input id="email" type="email" placeholder="seu@email.com" value={formData.customerEmail} onChange={e => setFormData(f => ({...f, customerEmail: e.target.value}))} />
                            </div>
                        </div>
                     </div>
                 </div>
             );

          case 5:
             // 💡 MENSAGEM ATUALIZADA (PRÉ-AGENDAMENTO + SINAL)
             return (
                 <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in zoom-in duration-500">
                     <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
                         <Check className="w-12 h-12 text-green-600" />
                     </div>
                     <h2 className="text-3xl font-bold text-green-800 mb-2">Pré-Agendamento Confirmado!</h2>
                     <p className="text-muted-foreground max-w-md">
                         Obrigado, <strong>{formData.customerName}</strong>. Seu horário está em pré-reserva. 
                         <br/><br/>
                         Enviamos os dados para pagamento do <strong>sinal (10%)</strong> no seu WhatsApp para confirmar o agendamento.
                     </p>
                     <div className="mt-8 space-x-4">
                        <Button variant="outline" onClick={() => window.location.reload()}>Novo Agendamento</Button>
                     </div>
                 </div>
             );
      }
  };

  return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-8 px-4">
          <div className="max-w-3xl mx-auto">
              <div className="text-center mb-10">
                  <h1 className="text-3xl font-bold text-primary tracking-tight mb-2">Agendamento Online</h1>
                  <p className="text-muted-foreground">Reserve seu horário de forma rápida e fácil</p>
              </div>
              
              <Card className="p-6 md:p-8 shadow-lg border-t-4 border-t-primary">
                  {step < 5 && (
                      <div className="mb-8">
                          <div className="flex justify-between text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                              <span className={step >= 1 ? "text-primary" : ""}>Serviços</span>
                              <span className={step >= 2 ? "text-primary" : ""}>Profissional</span>
                              <span className={step >= 3 ? "text-primary" : ""}>Horário</span>
                              <span className={step >= 4 ? "text-primary" : ""}>Confirmação</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                  className="h-full bg-primary transition-all duration-500 ease-out" 
                                  style={{ width: `${(step / 4) * 100}%` }}
                              />
                          </div>
                      </div>
                  )}

                  {renderStepContent()}
                  
                  {step < 5 && (
                      <div className="flex justify-between mt-8 pt-6 border-t">
                          <Button 
                            variant="ghost" 
                            onClick={() => setStep(s => s - 1)} 
                            disabled={step === 1 || createAppointmentMutation.isPending}
                          >
                              Voltar
                          </Button>

                          {step < 4 ? (
                              <Button 
                                onClick={handleNextStep} 
                                disabled={createAppointmentMutation.isPending}
                                className="pl-8 pr-6"
                              >
                                  Próximo <ArrowRight className="ml-2 w-4 h-4" />
                              </Button>
                          ) : (
                              <Button 
                                onClick={handleFinalize} 
                                disabled={
                                    !formData.customerName || 
                                    !formData.customerPhone || 
                                    createAppointmentMutation.isPending
                                }
                                className="bg-green-600 hover:bg-green-700 text-white pl-8 pr-6"
                              >
                                  {createAppointmentMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 w-4 h-4" />}
                                  Confirmar Agendamento
                              </Button>
                          )}
                      </div>
                  )}
              </Card>
          </div>
      </div>
  );
}
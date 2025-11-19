import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isSameDay, addMinutes, setHours, setMinutes, setSeconds, isPast, getDay, startOfMonth, endOfMonth, eachDayOfInterval, endOfDay } from "date-fns"; 
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { appointmentsAPI, servicesAPI, staffAPI, staffShiftsAPI, staffServicesAPI, locationsAPI } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ArrowRight, Check, Scissors, User, Clock, MapPin } from "lucide-react";

// --- INTERFACES E TIPOS ---
interface Service { id: string; name: string; price_centavos: number; default_duration_min: number; }
interface Staff { id: string; name: string; }
interface Location { id: string; name: string; }
interface StaffShift { staff_id: string; location_id: string; weekday: number; start_time: string; end_time: string; }
interface StaffService { staff_id: string; service_id: string; }
interface Appointment { id: string; staff: string; start_time: string; end_time: string; status: 'confirmed' | 'pending'; }

// ----------------------------------------------------
// LÓGICA DE DISPONIBILIDADE
// ----------------------------------------------------

const getAvailableSlots = (
  selectedDate: Date,
  selectedStaffId: string,
  selectedLocationId: string,
  serviceDurationMin: number,
  staffShifts: StaffShift[],
  allAppointments: Appointment[],
): string[] => {
  const dayOfWeek = getDay(selectedDate);
  
  const todayShifts = staffShifts.filter(s => 
    s.staff_id === selectedStaffId && 
    s.weekday === dayOfWeek &&
    s.location_id === selectedLocationId
  );

  if (todayShifts.length === 0) return [];

  const availableSlots: string[] = [];
  const currentAppointments = allAppointments.filter(apt => 
    apt.staff === selectedStaffId && 
    isSameDay(new Date(apt.start_time), selectedDate) &&
    (apt.status === 'confirmed' || apt.status === 'pending')
  ).map(apt => ({
    start: new Date(apt.start_time),
    end: new Date(apt.end_time)
  }));

  for (const shift of todayShifts) {
    const [shiftStartHour, shiftStartMinute] = shift.start_time.split(':').map(Number);
    const [shiftEndHour, shiftEndMinute] = shift.end_time.split(':').map(Number);

    let currentTime = setMinutes(setHours(selectedDate, shiftStartHour), shiftStartMinute);
    const endTimeLimit = setMinutes(setHours(selectedDate, shiftEndHour), shiftEndMinute);

    const now = new Date();
    if (isSameDay(currentTime, now)) {
        const startOfShift = currentTime.getTime();
        const startOfNow = now.getTime();
        
        if (startOfNow > startOfShift) {
            const elapsedMinutes = Math.floor((startOfNow - startOfShift) / (1000 * 60));
            const blocksPassed = Math.ceil(elapsedMinutes / serviceDurationMin);
            
            let nextSlotStart = addMinutes(setSeconds(setMinutes(setHours(selectedDate, shiftStartHour), shiftStartMinute), 0), blocksPassed * serviceDurationMin);

            if (nextSlotStart < endTimeLimit) {
                currentTime = nextSlotStart;
            } else {
                continue;
            }
        }
    }
    
    while (addMinutes(currentTime, serviceDurationMin) <= endTimeLimit) {
      const slotEnd = addMinutes(currentTime, serviceDurationMin);
      let isBooked = false;

      for (const apt of currentAppointments) {
        if (currentTime < apt.end && slotEnd > apt.start) {
          isBooked = true;
          currentTime = apt.end;
          break; 
        }
      }

      if (!isBooked) {
        const slotTime = format(currentTime, 'HH:mm');
        availableSlots.push(slotTime);
        currentTime = addMinutes(currentTime, serviceDurationMin);
      }
    }
  }

  return Array.from(new Set(availableSlots)).sort();
};


const curateAvailableSlots = (
  allSlots: string[],
  selectedDate: Date,
): string[] => {
  if (allSlots.length === 0) return [];

  const MORNING_END = '12:00';
  const AFTERNOON_END = '17:00';
  
  const morningSlots: string[] = [];
  const afternoonSlots: string[] = [];
  const eveningSlots: string[] = [];

  allSlots.forEach(slot => {
    if (slot < MORNING_END) {
      morningSlots.push(slot);
    } else if (slot < AFTERNOON_END) {
      afternoonSlots.push(slot);
    } else {
      eveningSlots.push(slot);
    }
  });

  const selectedSlots = new Set<string>();
  
  const addSpacedSlots = (slots: string[], count: number) => {
    if (slots.length === 0) return;
    
    selectedSlots.add(slots[0]);

    if (slots.length <= count) {
        slots.forEach(slot => selectedSlots.add(slot));
        return;
    }
    
    selectedSlots.add(slots[slots.length - 1]);
    selectedSlots.add(slots[Math.floor(slots.length / 2)]);
  };

  addSpacedSlots(morningSlots, 3);
  addSpacedSlots(afternoonSlots, 3);
  addSpacedSlots(eveningSlots, 3);

  
  const isToday = isSameDay(selectedDate, new Date());
  
  const nowTime = format(new Date(), 'HH:mm');
  let closestSlotIndex = -1;

  if (isToday) {
      closestSlotIndex = allSlots.findIndex(slot => slot >= nowTime);
  } else {
      closestSlotIndex = 0;
  }

  if (closestSlotIndex !== -1) {
      if (allSlots[closestSlotIndex]) {
          selectedSlots.add(allSlots[closestSlotIndex]);
      }
      
      for (let i = -2; i <= 2; i++) {
          const index = closestSlotIndex + i;
          if (index >= 0 && index < allSlots.length) {
              selectedSlots.add(allSlots[index]);
          }
      }
  }


  return Array.from(selectedSlots).sort();
};


// ----------------------------------------------------
// COMPONENTE PRINCIPAL
// ----------------------------------------------------

export default function AgendamentoCliente() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    selectedServiceIds: [] as string[], 
    staffId: '', 
    locationId: '', 
    date: new Date(), 
    time: '',
    customerName: '', 
    customerPhone: '', 
    customerEmail: ''
  });

  // 1. Fetch de Dados Essenciais
  const { data: services = [] } = useQuery<Service[]>({ queryKey: ['services'], queryFn: servicesAPI.getAll });
  const { data: allStaff = [] } = useQuery<Staff[]>({ queryKey: ['staff'], queryFn: staffAPI.getAll });
  const { data: staffServices = [] } = useQuery<StaffService[]>({ queryKey: ['staffServices'], queryFn: staffServicesAPI.getAll });
  const { data: staffShifts = [] } = useQuery<StaffShift[]>({ queryKey: ['staffShifts'], queryFn: staffShiftsAPI.getAll });
  const { data: allAppointments = [] } = useQuery<Appointment[]>({ queryKey: ['appointments'], queryFn: appointmentsAPI.getAll }); 
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ['locations'], queryFn: locationsAPI.getAll });

  // 2. Valores Computados
  const selectedServices = useMemo(() => 
    services.filter(s => formData.selectedServiceIds.includes(s.id)), 
    [formData.selectedServiceIds, services]
  );
  
  const totalDuration = useMemo(() => 
    selectedServices.reduce((sum, s) => sum + (s.default_duration_min || 0), 0), 
    [selectedServices]
  );
  const serviceDuration = totalDuration || 60;

  const totalPrice = useMemo(() => 
    selectedServices.reduce((sum, s) => sum + (s.price_centavos || 0), 0), 
    [selectedServices]
  );
  const formattedPrice = (totalPrice / 100).toFixed(2).replace('.', ',');

  const selectedLocation = useMemo(() => locations.find(l => l.id === formData.locationId), [formData.locationId, locations]);

  const handleServiceToggle = (serviceId: string) => {
    setFormData(f => {
        const currentIds = f.selectedServiceIds;
        const isSelected = currentIds.includes(serviceId);
        
        if (isSelected) {
            return {
                ...f,
                selectedServiceIds: currentIds.filter(id => id !== serviceId),
                staffId: currentIds.length === 1 ? '' : f.staffId,
                locationId: currentIds.length === 1 ? '' : f.locationId,
                time: ''
            };
        } 
        else {
            return {
                ...f,
                selectedServiceIds: [...currentIds, serviceId]
            };
        }
    });
  };


  const staffAvailableForService = useMemo(() => {
    if (formData.selectedServiceIds.length === 0) return [];
    
    let eligibleStaffIds: string[] = [];

    // 1. Intersecção de Staffs que podem fazer TODOS os serviços
    formData.selectedServiceIds.forEach((serviceId, index) => {
      const staffIdsForThisService = staffServices
        .filter(ss => ss.service_id === serviceId)
        .map(ss => ss.staff_id);
        
      if (index === 0) {
        eligibleStaffIds = staffIdsForThisService;
      } else {
        // Intercepta (mantém apenas os IDs que podem fazer o serviço anterior E o atual)
        eligibleStaffIds = eligibleStaffIds.filter(id => staffIdsForThisService.includes(id));
      }
    });
    
    if (eligibleStaffIds.length === 0) return [];

    // 2. Filtra a lista de Staff pelo Service Intersection
    let availableStaff = allStaff.filter(s => eligibleStaffIds.includes(s.id));

    // 3. Filtra por localização (SE uma localização foi selecionada)
    if (formData.locationId) {
        const staffIdsForLocation = new Set(staffShifts
            .filter(s => s.location_id === formData.locationId)
            .map(s => s.staff_id)
        );
        // Mantém apenas os profissionais que fazem o Serviço E estão na lista de staffIdsForLocation
        availableStaff = availableStaff.filter(s => staffIdsForLocation.has(s.id));
    }
    
    // Garantimos que o staffId seja resetado se o profissional selecionado não estiver mais na lista de elegíveis.
    if (formData.staffId && !availableStaff.map(s => s.id).includes(formData.staffId)) {
        setFormData(f => ({ ...f, staffId: '' }));
    }


    return availableStaff;
  }, [formData.selectedServiceIds, formData.locationId, allStaff, staffServices, staffShifts]);
  
  const availableDays = useMemo(() => {
    if (formData.selectedServiceIds.length === 0 || !formData.locationId) return new Set<string>();

    const availableStaffIds = staffAvailableForService.map(s => s.id);
    const availableDates = new Set<string>();

    const monthStart = startOfMonth(formData.date);
    const monthEnd = endOfMonth(formData.date);
    
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    daysInMonth.forEach(day => {
        const dayOfWeek = getDay(day);

        const staffHasShift = availableStaffIds.some(staffId => {
            return staffShifts.some(shift => 
                shift.staff_id === staffId && 
                shift.location_id === formData.locationId &&
                shift.weekday === dayOfWeek
            );
        });

        if (staffHasShift && !isPast(endOfDay(day))) {
            availableDates.add(format(day, 'yyyy-MM-dd'));
        }
    });

    return availableDates;
  }, [formData.selectedServiceIds.length, formData.locationId, formData.date, staffAvailableForService, staffShifts]);


  const availableSlots = useMemo(() => {
    if (!formData.staffId || !formData.date || formData.selectedServiceIds.length === 0 || !formData.locationId) return []; 
    
    const dateToSearch = setHours(setMinutes(formData.date, 0), 0);

    const allGeneratedSlots = getAvailableSlots(
      dateToSearch,
      formData.staffId,
      formData.locationId,
      serviceDuration,
      staffShifts as unknown as StaffShift[], 
      allAppointments as unknown as Appointment[]
    );
    
    return curateAvailableSlots(allGeneratedSlots, dateToSearch);

  }, [formData.staffId, formData.locationId, formData.date, formData.selectedServiceIds.length, serviceDuration, staffShifts, allAppointments]);

  // 3. Mutação de Agendamento
  const createAppointmentMutation = useMutation({
    mutationFn: (payload: any) => appointmentsAPI.create(payload),
    onSuccess: () => {
      toast.success("Agendamento criado com sucesso! Aguarde a confirmação.");
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setStep(5);
    },
    onError: (error: any) => {
      toast.error(error.message || "Falha ao criar agendamento. Tente novamente.");
    }
  });

  const handleNextStep = (nextStep: number) => {
    if (nextStep === 2 && formData.selectedServiceIds.length === 0) return toast.error("Selecione pelo menos um serviço primeiro.");
    if (nextStep === 3 && (!formData.locationId || !formData.staffId || !formData.date)) return toast.error("Selecione um local, profissional e uma data.");
    if (nextStep === 4 && !formData.time) return toast.error("Selecione um horário disponível.");
    
    setStep(nextStep);
  };
  
  const handleFinalizeBooking = () => {
    if (!formData.customerName || !formData.customerPhone) {
      return toast.error("Nome e telefone do cliente são obrigatórios.");
    }
    
    const [hour, minute] = formData.time.split(':').map(Number);
    const finalStartTime = setMinutes(setHours(formData.date, hour), minute);
    const finalEndTime = addMinutes(finalStartTime, serviceDuration);

    const payload = {
        customer_name: formData.customerName.trim(), 
        customer_phone: formData.customerPhone.trim(),
        customer_email: formData.customerEmail.trim(),
        
        service: formData.selectedServiceIds[0], // Campo 'service' (ID do primeiro serviço)
        services: formData.selectedServiceIds, // Enviando o array completo
        staff: formData.staffId,
        location: formData.locationId, 
        start_time: finalStartTime.toISOString(),
        end_time: finalEndTime.toISOString(),
        status: 'pending',
    };
    
    createAppointmentMutation.mutate(payload);
  };

  const StepIndicator = ({ currentStep }: { currentStep: number }) => (
    <div className="flex justify-between items-center mb-8">
      {[1, 2, 3, 4].map(s => (
        <div key={s} className="flex flex-col items-center flex-1">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
            s < currentStep ? 'bg-primary text-white' : s === currentStep ? 'bg-primary/50 text-white' : 'bg-muted text-muted-foreground'
          }`}>
            {s < currentStep ? <Check className="w-4 h-4" /> : s}
          </div>
          <p className="text-sm mt-1 text-center text-muted-foreground hidden sm:block">
            {s === 1 ? 'Serviço' : s === 2 ? 'Profissional' : s === 3 ? 'Horário' : 'Seus Dados'}
          </p>
        </div>
      ))}
    </div>
  );

  const renderStepContent = () => {
    // Funções auxiliares para formatar os dados
    const renderBold = (text: string | undefined) => <span className="font-semibold">{text || 'N/A'}</span>;
    const selectedStaff = allStaff.find(s => s.id === formData.staffId)?.name;
    const selectedServicesNames = selectedServices.map(s => s.name);
    
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2"><Scissors className="w-5 h-5" /> Selecione o(s) Serviço(s)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map(s => (
                <Card 
                  key={s.id} 
                  className={`p-4 cursor-pointer hover:border-primary transition-colors relative ${
                    formData.selectedServiceIds.includes(s.id) 
                      ? 'border-2 border-primary bg-primary/10' 
                      : 'border'
                  }`}
                  onClick={() => handleServiceToggle(s.id)}
                >
                  <h3 className="font-semibold">{s.name}</h3>
                  {formData.selectedServiceIds.includes(s.id) && (
                      <Check className="w-5 h-5 text-primary absolute top-2 right-2" />
                  )}
                  <p className="text-sm text-muted-foreground">R$ {(s.price_centavos / 100).toFixed(2).replace('.', ',')}</p>
                  <p className="text-xs text-muted-foreground">{s.default_duration_min} min</p>
                </Card>
              ))}
            </div>
            
            {formData.selectedServiceIds.length > 0 && (
                <div className="mt-6 p-4 border rounded-lg bg-muted">
                    <h3 className="font-semibold text-lg">Resumo do Pedido</h3>
                    <p className="text-sm">Serviços: <span className="font-bold">{selectedServicesNames.join(' + ')}</span></p>
                    <p className="text-sm">Duração Total: <span className="font-bold">{totalDuration} minutos</span></p>
                    <p className="text-sm">Valor Total: <span className="font-bold">R$ {formattedPrice}</span></p>
                </div>
            )}
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2"><User className="w-5 h-5" /> Profissional e Data</h2>
            
            <div className="flex flex-col lg:flex-row gap-6">
                
                <div className="lg:w-1/3 space-y-4">
                    {/* CAMPO: Localização */}
                    <Label className="flex items-center gap-1"><MapPin className="w-4 h-4" /> Local de Atendimento</Label>
                    <Select 
                        value={formData.locationId} 
                        onValueChange={(value) => setFormData(f => ({ ...f, locationId: value, staffId: '', time: '' }))}
                        disabled={locations.length === 0}
                    >
                        <SelectTrigger><SelectValue placeholder="Selecione a unidade..." /></SelectTrigger>
                        <SelectContent>
                            {locations.map(l => (
                                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* CAMPO: Profissional */}
                    <Label className="flex items-center gap-1"><User className="w-4 h-4" /> Selecione um Profissional</Label>
                    <Select 
                        value={formData.staffId} 
                        onValueChange={(value) => setFormData(f => ({ ...f, staffId: value, time: '' }))}
                        disabled={staffAvailableForService.length === 0 || !formData.locationId}
                    >
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                            {staffAvailableForService.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    
                    {/* 💡 ALERTA MELHORADO PARA CONFLITO MULTI-PROFISSIONAL */}
                    {staffAvailableForService.length === 0 && formData.selectedServiceIds.length > 0 && formData.locationId && (
                        <Alert variant="destructive">
                            <AlertDescription className="text-sm">
                                ❌ **Conflito de Profissionais:** Nenhum profissional pode realizar TODOS os serviços selecionados (ex: Massagem + Manicure). 
                                <br />
                                Por favor, **remova o serviço que gera conflito** e faça um agendamento separado para ele.
                            </AlertDescription>
                        </Alert>
                    )}
                    {formData.selectedServiceIds.length === 0 && <p className="text-sm text-muted-foreground">Selecione o(s) serviço(s) para ver os profissionais elegíveis.</p>}
                    {formData.selectedServiceIds.length > 0 && !formData.locationId && <p className="text-sm text-muted-foreground">Selecione o local para ver os profissionais disponíveis.</p>}
                </div>
                
                {/* Coluna do Calendário (Centralizada) */}
                <div className="lg:w-2/3 flex justify-center">
                    <Card className="p-2 inline-block">
                        <Label>Selecione a Data</Label>
                        <Calendar 
                            mode="single" 
                            selected={formData.date} 
                            onSelect={(d) => d && setFormData(f => ({ ...f, date: d, time: '' }))}
                            locale={ptBR}
                            disabled={(date) => {
                                const isDayInThePast = isPast(date) && !isSameDay(date, new Date());
                                
                                if (formData.locationId && formData.selectedServiceIds.length > 0) {
                                    const dateKey = format(date, 'yyyy-MM-dd');
                                    const hasAvailability = availableDays.has(dateKey);
                                    return isDayInThePast || !hasAvailability;
                                }
                                
                                return isDayInThePast;
                            }}
                            initialFocus
                        />
                    </Card>
                </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2"><Clock className="w-5 h-5" /> Selecione o Horário</h2>
            {/* LAYOUT E FORMATAÇÃO SOLICITADOS - Etapa 3 */}
            <Alert variant="default">
                <AlertDescription className="text-base leading-snug space-y-1">
                    <p className="font-bold">Serviços:</p>
                    <div className="ml-4 space-y-1">
                        {selectedServices.map((s) => (
                            <p key={s.id}>{renderBold(s.name)} ({renderBold(s.default_duration_min + ' min')})</p>
                        ))}
                    </div>
                    <p>Profissional: {renderBold(selectedStaff)}</p>
                    <p>Unidade: {renderBold(selectedLocation?.name)}</p>
                    <p>Data: {renderBold(format(formData.date, 'EEEE, dd/MM', { locale: ptBR }))}</p>
                    <p>Duração Total: {renderBold(totalDuration + ' minutos')}</p>
                </AlertDescription>
            </Alert>
            <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {availableSlots.length > 0 ? (
                availableSlots.map(slot => (
                  <Button 
                    key={slot} 
                    variant={formData.time === slot ? 'default' : 'outline'}
                    onClick={() => setFormData(f => ({ ...f, time: slot }))}
                    className="flex-col h-auto py-2"
                  >
                    <span className="text-lg font-bold">{slot}</span>
                  </Button>
                ))
              ) : (
                <p className="col-span-full text-center text-muted-foreground py-4">Nenhum horário disponível para a data, local e profissional selecionados.</p>
              )}
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold flex items-center gap-2"><User className="w-5 h-5" /> Seus Dados</h2>
            {/* LAYOUT E FORMATAÇÃO SOLICITADOS - Etapa 4 (Final) */}
            <Alert variant="default">
                <AlertDescription className="text-base leading-snug space-y-1">
                    <p className="font-bold">Serviços:</p>
                    <div className="ml-4 space-y-1">
                        {selectedServices.map((s, index) => (
                            <p key={s.id}>{index + 1}: {renderBold(s.name)}</p>
                        ))}
                    </div>
                    <p>Profissional: {renderBold(selectedStaff)}</p>
                    <p>Unidade: {renderBold(selectedLocation?.name)}</p>
                    <p>Data e Horário: {renderBold(`${format(formData.date, 'dd/MM', { locale: ptBR })} às ${formData.time}`)}</p>
                    <p>Duração Total: {renderBold(totalDuration + ' minutos')}</p>
                    <p>Valor Total: {renderBold(`R$ ${formattedPrice}`)}</p>
                </AlertDescription>
            </Alert>
            <div className="grid gap-4">
                <div>
                    <Label htmlFor="customerName">Seu Nome Completo *</Label>
                    <Input id="customerName" value={formData.customerName} onChange={e => setFormData(f => ({ ...f, customerName: e.target.value }))} />
                </div>
                <div>
                    <Label htmlFor="customerPhone">Telefone (Whatsapp) *</Label>
                    <Input id="customerPhone" value={formData.customerPhone} onChange={e => setFormData(f => ({ ...f, customerPhone: e.target.value }))} placeholder="(XX) XXXXX-XXXX" />
                </div>
                <div>
                    <Label htmlFor="customerEmail">E-mail (Opcional)</Label>
                    <Input id="customerEmail" type="email" value={formData.customerEmail} onChange={e => setFormData(f => ({ ...f, customerEmail: e.target.value }))} />
                </div>
            </div>
          </div>
        );
      case 5:
        return (
            <div className="text-center py-12 space-y-4">
                <Check className="w-16 h-16 text-primary mx-auto" />
                <h2 className="text-3xl font-bold">Agendamento Realizado!</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                    Seu pedido de agendamento foi enviado com sucesso. Você receberá uma confirmação no seu WhatsApp ou e-mail em breve.
                </p>
                <Button onClick={() => setStep(1)} className="mt-4">Novo Agendamento</Button>
            </div>
        )
    }
  };

  if (step === 5) {
      return (
        <div className="p-6">
            <Card className="p-8 max-w-xl mx-auto">
                {renderStepContent()}
            </Card>
        </div>
      );
  }


  return (
    <div className="p-6">
      <h1 className="text-4xl font-extrabold text-center text-primary mb-10">Agendamento Online</h1>
      
      <Card className="p-8 max-w-4xl mx-auto">
        <StepIndicator currentStep={step} />
        
        {renderStepContent()}

        <div className="mt-8 flex justify-between pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={() => setStep(step - 1)} 
            disabled={step === 1 || createAppointmentMutation.isPending || formData.selectedServiceIds.length === 0}
          >
            Voltar
          </Button>

          {step < 4 && (
            <Button 
                onClick={() => handleNextStep(step + 1)} 
                disabled={step === 1 && formData.selectedServiceIds.length === 0 || step === 2 && (!formData.locationId || !formData.staffId) || step === 3 && !formData.time || createAppointmentMutation.isPending}
            >
              Próximo <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}

          {step === 4 && (
            <Button 
                onClick={handleFinalizeBooking} 
                disabled={!formData.customerName || !formData.customerPhone || createAppointmentMutation.isPending}
            >
              {createAppointmentMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              {createAppointmentMutation.isPending ? "Agendando..." : "Confirmar Agendamento"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
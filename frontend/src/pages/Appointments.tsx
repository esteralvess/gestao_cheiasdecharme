import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, List, Calendar as CalendarIcon, X, Trash2, Gift, Sparkles, Gem } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import AppointmentCard from "@/components/AppointmentCard";
import CalendarView from "@/components/CalendarView";
import { PaymentConfirmationModal } from "@/components/PaymentConfirmationModal";
import { format, parseISO, setHours, setMinutes, setSeconds, addMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { appointmentsAPI, customersAPI, staffAPI, servicesAPI, locationsAPI, staffServicesAPI, staffShiftsAPI, referralsAPI } from "@/services/api";

// --- INTERFACES E TIPOS ---

interface AppointmentFromAPI { id: string; customer_name: string; staff_name: string; service_name: string; location_name: string; start_time: string; end_time: string; status: 'pending' | 'confirmed' | 'completed' | 'cancelled'; notes?: string; customer: string; staff: string; service: string; location: string; cancelled_at?: string; }
interface ProcessedAppointment { id: string; customerName: string; staffName: string; serviceName: string; locationName: string; startTime: Date; endTime: Date; status: 'pending' | 'confirmed' | 'completed' | 'cancelled'; notes?: string; customerId: string; staffId: string; serviceId: string; locationId: string; }
interface Customer { id: string; full_name: string; is_truly_new?: boolean; points?: number; }
interface Staff { id: string; name: string; }
interface Service { id: string; name: string; price_centavos?: number; default_duration_min?: number; }
interface Location { id: string; name: string; }
interface StaffService { staff_id: string; service_id: string; }
interface StaffShift { staff_id: string; location_id: string; }
interface Referral { id: string; referrer_customer: string; status: 'completed'; }

const ALL_FILTER_VALUE = "all";

// --- COMPONENTE: MODAL DE EDIÇÃO/CRIAÇÃO DE AGENDAMENTO ---

interface AppointmentEditModalProps {
  appointment: ProcessedAppointment | null;
  customers: Customer[]; 
  staff: Staff[]; 
  services: Service[]; 
  locations: Location[]; 
  staffServices: StaffService[]; 
  staffShifts: StaffShift[];
  referrals: Referral[];
  onClose: () => void; 
  onSave: (payload: any) => void; 
  onDelete: (id: string) => void; 
  isSaving: boolean; 
  isDeleting: boolean;
}

function AppointmentEditModal({ appointment, customers, staff, services, locations, staffServices, staffShifts, referrals, onClose, onSave, onDelete, isSaving, isDeleting }: AppointmentEditModalProps) {
  const queryClient = useQueryClient();
  const isNew = !appointment?.id;
  const prevServiceIdRef = useRef<string | null>(null);

  const [formData, setFormData] = useState({
    date: new Date(), startTime: '09:00', endTime: '10:00', customerId: '', staffId: '', serviceId: '', locationId: '', status: 'confirmed' as AppointmentFromAPI['status'], notes: '',
  });

  const [isRewardApplied, setIsRewardApplied] = useState(false);

  useEffect(() => {
    if (appointment) {
      setFormData({
        date: appointment.startTime, startTime: format(appointment.startTime, 'HH:mm'), endTime: format(appointment.endTime, 'HH:mm'), customerId: appointment.customerId, staffId: appointment.staffId, serviceId: appointment.serviceId, locationId: appointment.locationId, status: appointment.status, notes: appointment.notes || '',
      });
      prevServiceIdRef.current = appointment.serviceId;
      setIsRewardApplied(false);
    }
  }, [appointment]);

  const filteredStaff = useMemo(() => {
    if (!formData.serviceId) return [];
    const staffIdsForService = new Set(staffServices.filter(ss => ss.service_id === formData.serviceId).map(ss => ss.staff_id));
    return staff.filter(s => staffIdsForService.has(s.id));
  }, [formData.serviceId, staff, staffServices]);

  const filteredLocations = useMemo(() => {
    if (!formData.staffId) return [];
    const locationIdsForStaff = new Set(staffShifts.filter(shift => shift.staff_id === formData.staffId).map(shift => shift.location_id));
    return locations.filter(l => locationIdsForStaff.has(l.id));
  }, [formData.staffId, locations, staffShifts]);
  
  const selectedService = useMemo(() => {
    return services.find(s => s.id === formData.serviceId);
  }, [formData.serviceId, services]);

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === formData.customerId);
  }, [formData.customerId, customers]);

  const availableReward = useMemo(() => {
    if (!selectedCustomer) return null;
    return referrals.find(r => r.referrer_customer === selectedCustomer.id && r.status === 'completed');
  }, [selectedCustomer, referrals]);

  const applyRewardMutation = useMutation({
    mutationFn: (referralId: string) => referralsAPI.applyReward(referralId),
    onSuccess: () => {
      toast.success("Recompensa de 5% aplicada! O status da indicação foi atualizado.");
      setIsRewardApplied(true);
      queryClient.invalidateQueries({ queryKey: ['referrals'] });
    },
    onError: (error: any) => toast.error(error.message || "Falha ao aplicar recompensa.")
  });

  const redeemPointsMutation = useMutation({
    mutationFn: ({ customerId, points }: { customerId: string; points: number }) => 
      customersAPI.redeemPoints(customerId, { points_to_redeem: points }),
    onSuccess: (updatedCustomer, variables) => {
        const discountValue = (variables.points / 10).toFixed(2);
        toast.success(`${variables.points} pontos resgatados com sucesso!`);
        setFormData(f => ({
            ...f,
            notes: (f.notes ? f.notes + '\n' : '') + `DESCONTO: R$${discountValue} (resgate de ${variables.points} pontos).`
        }));
        queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error: any) => toast.error(error.message || "Falha ao resgatar pontos."),
  });

  const handleRedeemPoints = () => {
    if (!selectedCustomer || !selectedCustomer.points || selectedCustomer.points <= 0) return;
    const pointsToRedeemStr = window.prompt(`Quantos pontos deseja resgatar? (Disponível: ${selectedCustomer.points})`);
    if (pointsToRedeemStr) {
      const pointsToRedeem = parseInt(pointsToRedeemStr, 10);
      if (isNaN(pointsToRedeem) || pointsToRedeem <= 0) {
        toast.error("Por favor, insira um número de pontos válido.");
        return;
      }
      if (pointsToRedeem > selectedCustomer.points) {
        toast.error("Pontos insuficientes para este resgate.");
        return;
      }
      redeemPointsMutation.mutate({ customerId: selectedCustomer.id, points: pointsToRedeem });
    }
  };

  useEffect(() => {
    if (prevServiceIdRef.current !== null && prevServiceIdRef.current !== formData.serviceId) {
        setFormData(f => ({ ...f, staffId: '', locationId: '' }));
    }
    prevServiceIdRef.current = formData.serviceId;
  }, [formData.serviceId]);

  useEffect(() => {
    if (selectedService && selectedService.default_duration_min && formData.startTime) {
      const [startHour, startMinute] = formData.startTime.split(':').map(Number);
      const startTimeObject = setMinutes(setHours(formData.date, startHour), startMinute);
      const newEndTime = addMinutes(startTimeObject, selectedService.default_duration_min);
      setFormData(f => ({ ...f, endTime: format(newEndTime, 'HH:mm') }));
    }
  }, [formData.serviceId, formData.startTime, formData.date, selectedService]);

  const handleSave = () => {
    if (!appointment) return;
    
    if (formData.status === 'completed' && appointment.status !== 'completed') {
        const currentAppointmentState = {
            ...appointment,
            ...formData,
            startTime: setMinutes(setHours(formData.date, parseInt(formData.startTime.split(':')[0])), parseInt(formData.startTime.split(':')[1])),
            endTime: setMinutes(setHours(formData.date, parseInt(formData.endTime.split(':')[0])), parseInt(formData.endTime.split(':')[1])),
        };
        onSave({ openPaymentModal: true, appointment: currentAppointmentState });
        onClose();
        return;
    }

    const [startHour, startMinute] = formData.startTime.split(':').map(Number);
    const [endHour, endMinute] = formData.endTime.split(':').map(Number);
    const finalStartTime = setSeconds(setMinutes(setHours(formData.date, startHour), startMinute), 0);
    const finalEndTime = setSeconds(setMinutes(setHours(formData.date, endHour), endMinute), 0);
    const payload = {
      id: appointment.id, customer: formData.customerId, staff: formData.staffId, service: formData.serviceId, location: formData.locationId, start_time: finalStartTime.toISOString(), end_time: finalEndTime.toISOString(), status: formData.status, notes: formData.notes,
    };
    onSave({ payload });
  };

  const handleCancelAppointment = () => {
    if (!appointment || !appointment.id) return;
    if (window.confirm("Tem certeza que deseja CANCELAR este agendamento?")) {
        onSave({ payload: { id: appointment.id, status: 'cancelled', cancelled_at: new Date().toISOString() } });
    }
  };

  const handleDelete = () => {
    if (!appointment || !appointment.id) return;
    if (window.confirm("⚠️ ATENÇÃO! Tem certeza que deseja EXCLUIR PERMANENTEMENTE este agendamento? Esta ação não pode ser desfeita.")) {
        onDelete(appointment.id);
    }
  }
  
  if (!appointment) return null;

  return (
    <Dialog open={!!appointment} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Novo Agendamento' : 'Editar Agendamento'}</DialogTitle>
          {!isNew && ( <p className="text-sm text-muted-foreground">{appointment.customerName} - {appointment.serviceName}</p> )}
        </DialogHeader>
        <div className="grid gap-4 py-4">
            
            {selectedCustomer?.is_truly_new && (
              <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800">
                <Sparkles className="h-4 w-4" />
                <AlertTitle>Cliente de Primeira Viagem!</AlertTitle>
                <AlertDescription>
                  Lembre-se de aplicar o desconto de 10% no valor do serviço.
                </AlertDescription>
              </Alert>
            )}

            {availableReward && (
              <Alert variant="default" className="bg-emerald-50 border-emerald-200 text-emerald-800">
                <Gift className="h-4 w-4" />
                <AlertTitle>Recompensa Disponível!</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                  <span>Esta cliente tem um desconto de 5% por indicação.</span>
                  <Button 
                    size="sm" 
                    onClick={() => applyRewardMutation.mutate(availableReward.id)}
                    disabled={isRewardApplied || applyRewardMutation.isPending}
                  >
                    {isRewardApplied ? "Aplicada!" : (applyRewardMutation.isPending ? "Aplicando..." : "Aplicar Recompensa")}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {selectedCustomer && (selectedCustomer.points ?? 0) > 0 && (
              <Alert variant="default" className="bg-amber-50 border-amber-200 text-amber-800">
                <Gem className="h-4 w-4" />
                <AlertTitle>Programa de Pontos</AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                  <span>
                    Saldo: <strong>{selectedCustomer.points} pontos</strong> (R$ {((selectedCustomer.points ?? 0) / 10).toFixed(2)})
                  </span>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="border-amber-300 hover:bg-amber-100"
                    onClick={handleRedeemPoints}
                    disabled={redeemPointsMutation.isPending}
                  >
                    {redeemPointsMutation.isPending ? "Resgatando..." : "Resgatar Pontos"}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <div>
                <Label>Cliente</Label>
                <Select value={formData.customerId} onValueChange={(value) => setFormData(f => ({ ...f, customerId: value }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione um cliente..." /></SelectTrigger>
                    <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                    <Label>Serviço</Label>
                    <Select value={formData.serviceId} onValueChange={(value) => setFormData(f => ({ ...f, serviceId: value }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione um serviço" /></SelectTrigger>
                        <SelectContent>{services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Valor (R$)</Label>
                    <Input readOnly disabled value={ selectedService && selectedService.price_centavos ? (selectedService.price_centavos / 100).toFixed(2).replace('.', ',') : '0,00' } />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label>Profissional</Label>
                    <Select disabled={!formData.serviceId} value={formData.staffId} onValueChange={(value) => setFormData(f => ({ ...f, staffId: value }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione um profissional..." /></SelectTrigger>
                        <SelectContent>{filteredStaff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Unidade</Label>
                    <Select disabled={!formData.staffId} value={formData.locationId} onValueChange={(value) => setFormData(f => ({ ...f, locationId: value }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione uma unidade..." /></SelectTrigger>
                        <SelectContent>{filteredLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <Label>Data</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {format(formData.date, 'dd/MM/yyyy')}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={formData.date} onSelect={(d) => d && setFormData(f => ({...f, date: d}))} initialFocus locale={ptBR} />
                        </PopoverContent>
                    </Popover>
                </div>
                <div><Label>Início</Label><Input type="time" value={formData.startTime} onChange={e => setFormData(f => ({ ...f, startTime: e.target.value }))} /></div>
                <div><Label>Fim</Label><Input type="time" value={formData.endTime} onChange={e => setFormData(f => ({ ...f, endTime: e.target.value }))} /></div>
            </div>
            <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(value: AppointmentFromAPI['status']) => setFormData(f => ({ ...f, status: value }))}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="confirmed">Confirmado</SelectItem>
                        <SelectItem value="completed">Concluído</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div><Label>Observações</Label><Textarea value={formData.notes} onChange={e => setFormData(f => ({...f, notes: e.target.value}))}/></div>
        </div>
        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between sm:space-x-2">
            <div>
                {!isNew && (
                    <div className="flex gap-2">
                        <Button variant="destructive" onClick={handleCancelAppointment} disabled={isSaving || isDeleting}>
                            Cancelar Agendamento
                        </Button>
                        <Button variant="outline" size="icon" onClick={handleDelete} disabled={isSaving || isDeleting} title="Excluir Agendamento (Irreversível)">
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                )}
            </div>
            <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose} disabled={isSaving || isDeleting}>{isNew ? 'Cancelar' : 'Fechar'}</Button>
                <Button onClick={handleSave} disabled={isSaving || isDeleting}>{isSaving ? "Salvando..." : (isNew ? "Criar Agendamento" : "Salvar Alterações")}</Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// FUNÇÃO PARA PEGAR A DATA INICIAL DA URL OU USAR A DATA DE HOJE
const getInitialDate = (): Date => {
  if (typeof window === "undefined") {
    return new Date();
  }
  
  const params = new URLSearchParams(window.location.search);
  const dateFromUrl = params.get('date');

  if (dateFromUrl && /^\d{4}-\d{2}-\d{2}$/.test(dateFromUrl)) {
    return new Date(`${dateFromUrl}T12:00:00`);
  }

  return new Date();
};


// --- COMPONENTE PRINCIPAL ---
export default function Appointments() {
  const queryClient = useQueryClient();
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(getInitialDate);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<ProcessedAppointment | null>(null);
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [staffFilter, setStaffFilter] = useState<string>('');
  
  const [confirmingPayment, setConfirmingPayment] = useState<ProcessedAppointment | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('date')) {
      setViewMode('list');
      window.history.replaceState({}, '', '/appointments');
    }
  }, []); 

  const { data: staffServices = [] } = useQuery<StaffService[]>({ queryKey: ['staffServices'], queryFn: staffServicesAPI.getAll });
  const { data: staffShifts = [] } = useQuery<StaffShift[]>({ queryKey: ['staffShifts'], queryFn: staffShiftsAPI.getAll });
  const { data: customers = [] } = useQuery<Customer[]>({ queryKey: ['customers'], queryFn: customersAPI.getAll });
  const { data: staff = [] } = useQuery<Staff[]>({ queryKey: ['staff'], queryFn: staffAPI.getAll });
  const { data: services = [] } = useQuery<Service[]>({ queryKey: ['services'], queryFn: servicesAPI.getAll });
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ['locations'], queryFn: locationsAPI.getAll });
  const { data: referrals = [] } = useQuery<Referral[]>({ queryKey: ['referrals'], queryFn: referralsAPI.getAll });
  
  const { data: allAppointments = [], isLoading } = useQuery<AppointmentFromAPI[]>({
    queryKey: ['appointments'],
    queryFn: appointmentsAPI.getAll,
  });

  const saveAppointment = useMutation({
      mutationFn: (payload: { id: string } & Partial<Omit<AppointmentFromAPI, 'id'>>) => {
          const { id, ...data } = payload;
          return id ? appointmentsAPI.update(id, data) : appointmentsAPI.create(data);
      },
      onSuccess: (data, variables) => {
          const isNew = !variables.id;
          if(variables.status === 'cancelled') {
            toast.error("Agendamento cancelado.");
          } else {
            toast.success(`Agendamento ${isNew ? 'criado' : 'atualizado'} com sucesso!`);
          }
          setEditingAppointment(null);
          setConfirmingPayment(null);
          queryClient.invalidateQueries({ queryKey: ['appointments'] });
          queryClient.invalidateQueries({ queryKey: ['customers'] });
      },
      onError: (error: any) => {
          toast.error(error.message || `Falha ao salvar.`);
          console.error("Erro ao salvar agendamento:", error);
      }
  });

  const deleteAppointment = useMutation({
      mutationFn: (id: string) => appointmentsAPI.delete(id),
      onSuccess: () => {
          toast.success("Agendamento excluído com sucesso!");
          setEditingAppointment(null);
          queryClient.invalidateQueries({ queryKey: ['appointments'] });
      },
      onError: (error: any) => {
          toast.error(error.message || `Falha ao excluir.`);
          console.error("Erro ao excluir agendamento:", error);
      }
  });

  const processedAppointments: ProcessedAppointment[] = useMemo(() => {
    if (!allAppointments) return [];
    return allAppointments
      .map(apt => ({
        id: apt.id, status: apt.status, customerName: apt.customer_name, serviceName: apt.service_name, staffName: apt.staff_name, locationName: apt.location_name,
        startTime: parseISO(apt.start_time), endTime: parseISO(apt.end_time), notes: apt.notes, customerId: apt.customer, staffId: apt.staff, serviceId: apt.service, locationId: apt.location,
      }))
      .filter(apt => {
        const locationMatch = locationFilter ? apt.locationId === locationFilter : true;
        const staffMatch = staffFilter ? apt.staffId === staffFilter : true;
        return locationMatch && staffMatch;
      });
  }, [allAppointments, locationFilter, staffFilter]);

  const dailyAppointments = useMemo(() => {
    if (!selectedDate) return [];
    return processedAppointments.filter(
      apt => format(apt.startTime, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd")
    ).sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }, [processedAppointments, selectedDate]);
  
  const handleSaveFlow = (data: any) => {
    if (data.openPaymentModal) {
        setConfirmingPayment(data.appointment);
    } else if (data.payload) {
        saveAppointment.mutate(data.payload);
    }
  };

  const handleConfirmPayment = (paymentDetails: {
    payment_method: string;
    discount_centavos: number;
    final_amount_centavos: number;
  }) => {
    if (!confirmingPayment) return;

    const payload = {
        id: confirmingPayment.id,
        status: 'completed' as 'completed',
        ...paymentDetails
    };

    saveAppointment.mutate(payload);
  };
  
  const servicePriceForPayment = useMemo(() => {
    if (!confirmingPayment) return 0;
    const service = services.find(s => s.id === confirmingPayment.serviceId);
    return service?.price_centavos || 0;
  }, [confirmingPayment, services]);


  const handleNewAppointmentClick = () => {
    const newAppointmentTemplate: ProcessedAppointment = {
      id: '', customerName: '', staffName: '', serviceName: '', locationName: '',
      startTime: setSeconds(setMinutes(setHours(new Date(), 9), 0), 0),
      endTime: setSeconds(setMinutes(setHours(new Date(), 10), 0), 0),
      status: 'confirmed', notes: '', customerId: '', staffId: '', serviceId: '', locationId: '',
    };
    setEditingAppointment(newAppointmentTemplate);
  };

  return (
    <div className="p-6 space-y-6">
      <AppointmentEditModal 
        appointment={editingAppointment}
        onClose={() => setEditingAppointment(null)}
        onSave={handleSaveFlow}
        onDelete={deleteAppointment.mutate}
        isSaving={saveAppointment.isPending}
        isDeleting={deleteAppointment.isPending}
        customers={customers}
        staff={staff}
        services={services}
        locations={locations}
        staffServices={staffServices}
        staffShifts={staffShifts}
        referrals={referrals}
      />

      <PaymentConfirmationModal
        isOpen={!!confirmingPayment}
        onClose={() => setConfirmingPayment(null)}
        onConfirm={handleConfirmPayment}
        servicePrice={servicePriceForPayment}
        isSaving={saveAppointment.isPending}
      />

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground mb-1">Agenda</h1>
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="text-muted-foreground text-lg p-0 h-auto">
                  {selectedDate ? format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR }) : "Selecione uma data" }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single" selected={selectedDate}
                  onSelect={(date) => { setSelectedDate(date); setIsDatePickerOpen(false); }}
                  initialFocus locale={ptBR}
                />
              </PopoverContent>
            </Popover>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("list")} className="gap-2">
              <List className="w-4 h-4" /> Lista
            </Button>
            <Button variant={viewMode === "calendar" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("calendar")} className="gap-2">
              <CalendarIcon className="w-4 h-4" /> Calendário
            </Button>
          </div>

          <Select value={locationFilter || ALL_FILTER_VALUE} onValueChange={(value) => setLocationFilter(value === ALL_FILTER_VALUE ? '' : value)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Unidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER_VALUE}>Todas Unidades</SelectItem>
              {locations.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={staffFilter || ALL_FILTER_VALUE} onValueChange={(value) => setStaffFilter(value === ALL_FILTER_VALUE ? '' : value)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Profissional" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER_VALUE}>Todos Profissionais</SelectItem>
              {staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          
          <Button onClick={handleNewAppointmentClick}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Agendamento
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground">Carregando agendamentos...</p>
      ) : viewMode === 'list' ? (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarIcon className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Agendamentos do Dia</h2>
          </div>
          <div className="space-y-3">
            {dailyAppointments.length > 0 ? (
              dailyAppointments.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  {...appointment}
                  onClick={() => setEditingAppointment(appointment)}
                />
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">Nenhum agendamento para esta data.</p>
            )}
          </div>
        </Card>
      ) : (
        <CalendarView
          appointments={processedAppointments}
          onAppointmentClick={(apt) => setEditingAppointment(apt as ProcessedAppointment)}
          onDateClick={(date) => {
              setSelectedDate(date);
              setViewMode("list");
          }}
        />
      )}
    </div>
  );
}
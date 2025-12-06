import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isSameDay, addMinutes, setHours, setMinutes, isPast, getDay, parseISO, addDays, startOfDay } from "date-fns"; 
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { appointmentsAPI, servicesAPI, staffAPI, staffShiftsAPI, staffServicesAPI, locationsAPI, customersAPI, promotionsAPI } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // ✅ Novo Import
import { Checkbox } from "@/components/ui/checkbox"; // ✅ Novo Import
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Check, Scissors, User, Clock, MapPin, CalendarCheck, Sparkles, ArrowRight, Tag, Package, CalendarDays, ArrowLeft } from "lucide-react";

// --- INTERFACES ---
interface Service { id: string; name: string; price_centavos: number; default_duration_min: number; category: string; }
interface Staff { id: string; name: string; }
interface Location { id: string; name: string; }
interface StaffShift { staff_id: string; location_id: string; weekday: number; start_time: string; end_time: string; }
interface StaffService { staff_id: string; service_id: string; }
interface Appointment { id: string; staff: string; start_time: string; end_time: string; status: string; }
interface Promotion { 
    id: string; title: string; type: 'combo' | 'package'; price_centavos: number; 
    items: {service: string; service_id?: string; quantity: number}[]; 
    description?: string; 
    min_interval_days?: number; suggested_interval_days?: number; days_to_expire?: number;
}

// --- HELPERS ---
const cleanPhone = (phone: string) => phone.replace(/\D/g, "");
const formatPhoneDisplay = (value: string) => {
    const nums = cleanPhone(value);
    if (nums.length <= 2) return nums;
    if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
    return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7, 11)}`;
};

const toLocalISOString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

export default function AgendamentoCliente() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  
  // Controle do Loop de Pacotes
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0);
  const [packageSessions, setPackageSessions] = useState<any[]>([]); 

  // Novos Estados
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false); // ✅ Controle do Checkbox
  const [userNotes, setUserNotes] = useState(""); // ✅ Observações do Cliente

  const [formData, setFormData] = useState({
    selectedId: '', 
    type: 'service' as 'service' | 'combo' | 'package',
    items: [] as {service_id: string, quantity: number}[],
    
    currentDate: undefined as Date | undefined,
    currentTime: '',
    currentStaffId: '',
    
    locationId: '', 
    customerName: '', 
    customerPhone: '', 
    customerEmail: ''
  });

  // Queries (Data Fetching)
  const { data: services = [] } = useQuery<Service[]>({ queryKey: ['services'], queryFn: servicesAPI.getAll });
  const { data: promotions = [] } = useQuery<Promotion[]>({ queryKey: ['promotions'], queryFn: promotionsAPI.getAll });
  const { data: allStaff = [] } = useQuery<Staff[]>({ queryKey: ['staff'], queryFn: staffAPI.getAll });
  const { data: staffServices = [] } = useQuery<StaffService[]>({ queryKey: ['staffServices'], queryFn: staffServicesAPI.getAll });
  const { data: staffShifts = [] } = useQuery<StaffShift[]>({ queryKey: ['staffShifts'], queryFn: staffShiftsAPI.getAll });
  const { data: allAppointments = [] } = useQuery<Appointment[]>({ queryKey: ['appointments'], queryFn: appointmentsAPI.getAll }); 
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ['locations'], queryFn: locationsAPI.getAll });

  // Derivados
  const categories = useMemo(() => {
      const allCats = services.map(s => s.category).filter(Boolean);
      return ["Todos", ...Array.from(new Set(allCats)).sort()];
  }, [services]);

  const orderedServices = useMemo(() => {
      return formData.items.flatMap(item => {
          const srv = services.find(s => s.id === item.service_id);
          return srv ? Array(item.quantity).fill(srv) : [];
      });
  }, [formData.items, services]);

  const currentServiceToSchedule = orderedServices[currentSessionIndex];
  const selectedPromo = promotions.find(p => p.id === formData.selectedId);

  const totalPrice = useMemo(() => {
      if (formData.type !== 'service' && selectedPromo) return selectedPromo.price_centavos;
      return orderedServices.reduce((sum, s) => sum + (s.price_centavos || 0), 0);
  }, [formData, orderedServices, selectedPromo]);

  const formattedPrice = (totalPrice / 100).toFixed(2).replace('.', ',');
  const selectedLocation = useMemo(() => locations.find(l => l.id === formData.locationId), [formData.locationId, locations]);

  // --- HANDLERS ---
  const handleSelectService = (service: Service) => {
      setFormData(f => ({ ...f, selectedId: service.id, type: 'service', items: [{ service_id: service.id, quantity: 1 }], currentDate: undefined, currentTime: '', currentStaffId: '' }));
      setCurrentSessionIndex(0); setPackageSessions([]);
  };

  const handleSelectPromotion = (promo: Promotion) => {
      const mappedItems = promo.items.map(item => ({
          service_id: item.service || item.service_id || '', 
          quantity: item.quantity
      }));
      setFormData(f => ({ ...f, selectedId: promo.id, type: promo.type, items: mappedItems, currentDate: undefined, currentTime: '', currentStaffId: '' }));
      setCurrentSessionIndex(0); setPackageSessions([]);
  };

  const getStaffForService = (serviceId: string) => {
      if (!formData.locationId) return [];
      const staffIds = new Set(staffServices.filter(ss => ss.service_id === serviceId).map(ss => ss.staff_id));
      const locationStaffIds = new Set(staffShifts.filter(s => s.location_id === formData.locationId).map(s => s.staff_id));
      return allStaff.filter(s => staffIds.has(s.id) && locationStaffIds.has(s.id));
  };

  // --- CALENDÁRIO ---
  const minDate = useMemo(() => {
      if (currentSessionIndex === 0) return new Date();
      if (formData.type === 'package' && selectedPromo?.min_interval_days && packageSessions.length > 0) {
          const lastSessionDate = packageSessions[packageSessions.length - 1].date;
          return addDays(lastSessionDate, selectedPromo.min_interval_days);
      }
      return new Date();
  }, [currentSessionIndex, packageSessions, formData.type, selectedPromo]);

  const isDateDisabled = (date: Date) => {
      if (isPast(date) && !isSameDay(date, new Date())) return true;
      if (startOfDay(date) < startOfDay(minDate)) return true;
      if (formData.currentStaffId) {
          const jsDay = getDay(date);
          const dbDay = jsDay === 0 ? 7 : jsDay; 
          const hasShift = staffShifts.some(s => s.staff_id === formData.currentStaffId && s.location_id === formData.locationId && s.weekday === dbDay);
          if (!hasShift) return true;
      }
      return false;
  };

  // --- HORÁRIOS ---
  const availableSlots = useMemo(() => {
      if (!formData.currentDate || !formData.currentStaffId || !currentServiceToSchedule) return [];
      const jsDay = getDay(formData.currentDate);
      const dbDay = jsDay === 0 ? 7 : jsDay;
      const shifts = staffShifts.filter(s => s.staff_id === formData.currentStaffId && s.weekday === dbDay && s.location_id === formData.locationId);
      const validSlots = new Set<string>();

      shifts.forEach(shift => {
          const [sh, sm] = shift.start_time.split(':').map(Number);
          const [eh, em] = shift.end_time.split(':').map(Number);
          let current = setMinutes(setHours(formData.currentDate!, sh), sm);
          const shiftEnd = setMinutes(setHours(formData.currentDate!, eh), em);

          if (isSameDay(current, new Date()) && current < new Date()) {
             const now = new Date();
             const blocks = Math.ceil((now.getHours()*60 + now.getMinutes() - (sh*60+sm))/30);
             current = addMinutes(current, blocks*30);
          }

          while (current < shiftEnd) {
              const srvDur = currentServiceToSchedule.default_duration_min || 30;
              const slotEnd = addMinutes(current, srvDur);
              const conflict = allAppointments.some(a => {
                  if (a.status === 'cancelled' || a.staff !== formData.currentStaffId) return false;
                  const as = parseISO(a.start_time);
                  const ae = parseISO(a.end_time);
                  return (current >= as && current < ae) || (slotEnd > as && slotEnd <= ae);
              });
              const sessionConflict = packageSessions.some(s => {
                  if (s.staffId !== formData.currentStaffId) return false;
                  return isSameDay(s.date, formData.currentDate!); 
              });

              if (!conflict && !sessionConflict && slotEnd <= shiftEnd) validSlots.add(format(current, 'HH:mm'));
              current = addMinutes(current, 30);
          }
      });
      return Array.from(validSlots).sort();
  }, [formData.currentDate, formData.currentStaffId, staffShifts, allAppointments, currentServiceToSchedule, packageSessions, formData.locationId]);

  // --- ACTIONS ---
  
  // 💡 LÓGICA DE BUSCA DE CLIENTE AJUSTADA
  const handlePhoneBlur = async () => {
      const raw = cleanPhone(formData.customerPhone);
      if (raw.length < 10) return; // Mínimo para um telefone válido
      
      setIsCheckingPhone(true);
      try {
          // Tenta buscar com '55' na frente, pois é o padrão do banco
          const searchPhone = raw.startsWith('55') ? raw : `55${raw}`;
          const res = await customersAPI.checkPhone(searchPhone);
          
          if (res.exists) {
              setFormData(f => ({...f, customerName: res.name, customerEmail: res.email || f.customerEmail}));
              toast.success(`Olá, ${res.name.split(' ')[0]}! Seus dados foram carregados.`);
          }
      } catch (e) { 
          // Silencioso se não encontrar (é um novo cliente)
      } finally { 
          setIsCheckingPhone(false); 
      }
  };

  const handleNextStep = () => {
      if (step === 1 && !formData.selectedId) return toast.error("Selecione uma opção.");
      if (step === 2 && !formData.locationId) return toast.error("Selecione a unidade.");
      if (step === 3 && (!formData.currentStaffId || !formData.currentDate)) return toast.error("Selecione profissional e data.");
      if (step === 4 && !formData.currentTime) return toast.error("Selecione um horário.");

      if (step === 4) {
          const newSession = {
              service: currentServiceToSchedule,
              staffId: formData.currentStaffId,
              staffName: allStaff.find(s => s.id === formData.currentStaffId)?.name,
              date: formData.currentDate!,
              time: formData.currentTime
          };
          setPackageSessions([...packageSessions, newSession]);

          if (currentSessionIndex < orderedServices.length - 1) {
              setCurrentSessionIndex(prev => prev + 1);
              setFormData(f => ({ ...f, currentDate: undefined, currentTime: '', currentStaffId: '' }));
              toast.success(`Sessão ${currentSessionIndex + 1} definida! Escolha a próxima.`);
              setStep(3); 
          } else {
              setStep(5);
          }
      } else {
          setStep(s => s + 1);
      }
  };

  const createAppointmentMutation = useMutation({
    mutationFn: async (payload: any) => appointmentsAPI.create(payload),
    onSuccess: () => {}, 
    onError: (err: any) => toast.error("Erro ao agendar: " + err.message)
  });

  const handleFinalize = async () => {
      if (!formData.customerName || !formData.customerPhone) return toast.error("Preencha seus dados.");
      if (!consentGiven) return toast.error("É necessário aceitar os termos.");

      try {
          for (let i = 0; i < packageSessions.length; i++) {
              const session = packageSessions[i];
              const [h, m] = session.time.split(':').map(Number);
              const start = setMinutes(setHours(session.date, h), m);
              const end = addMinutes(start, session.service.default_duration_min || 30);
              
              // Monta a nota final com a observação do cliente
              const systemNote = `Sessão ${i+1}/${packageSessions.length} - ${selectedPromo?.title || 'Avulso'}`;
              const finalNote = userNotes ? `${systemNote}\nObs do Cliente: ${userNotes}` : systemNote;

              await appointmentsAPI.create({
                  customer_name: formData.customerName,
                  customer_phone: `55${cleanPhone(formData.customerPhone)}`, 
                  customer_email: formData.customerEmail,
                  location: formData.locationId,
                  staff: session.staffId,
                  service: session.service.id,
                  start_time: toLocalISOString(start),
                  end_time: toLocalISOString(end),
                  status: 'pending',
                  notes: finalNote,
              });
          }
          toast.success("Agendamentos realizados com sucesso!");
          setStep(6);
          queryClient.invalidateQueries({ queryKey: ['appointments'] });
      } catch (error) {
          console.error(error);
          toast.error("Houve um erro ao processar. Tente novamente.");
      }
  };

  // --- RENDER ---
  const renderStep1 = () => (
    <div className="space-y-6 animate-in fade-in">
        <div className="text-center space-y-2 mb-8">
            <h2 className="text-2xl font-bold text-primary">Bem-vinda(o)!</h2>
            <p className="text-muted-foreground">Escolha como quer se cuidar hoje.</p>
        </div>
        
        <Tabs defaultValue="services" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted/50 p-1 rounded-xl h-12">
                <TabsTrigger value="services" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Avulsos</TabsTrigger>
                <TabsTrigger value="combos" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Combos</TabsTrigger>
                <TabsTrigger value="packages" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Pacotes</TabsTrigger>
            </TabsList>

            <TabsContent value="services" className="space-y-4">
                <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
                    {categories.map(cat => (
                        <Badge key={cat} variant={selectedCategory === cat ? "default" : "outline"} className={`cursor-pointer px-4 py-1.5 text-sm ${selectedCategory === cat ? 'bg-primary hover:bg-primary/90' : 'hover:bg-muted'}`} onClick={() => setSelectedCategory(cat)}>{cat}</Badge>
                    ))}
                </div>
                <div className="grid grid-cols-1 gap-3">
                    {services.filter(s => selectedCategory === "Todos" || s.category === selectedCategory).map(s => (
                        <div key={s.id} onClick={() => handleSelectService(s)} className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 flex justify-between items-center ${formData.selectedId === s.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/50 hover:bg-muted/30'}`}>
                            <div><h3 className="font-semibold text-foreground">{s.name}</h3><p className="text-sm text-muted-foreground mt-0.5">{s.default_duration_min} min</p></div>
                            <span className="font-bold text-primary">R$ {(s.price_centavos/100).toFixed(2).replace('.',',')}</span>
                        </div>
                    ))}
                </div>
            </TabsContent>

            <TabsContent value="combos" className="space-y-3">
                {promotions.filter(p => p.type === 'combo').map(p => (
                    <div key={p.id} onClick={() => handleSelectPromotion(p)} className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${formData.selectedId === p.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/50 hover:bg-muted/30'}`}>
                        <div className="flex justify-between items-start mb-2"><h3 className="font-semibold flex items-center gap-2"><Tag className="w-4 h-4 text-orange-500"/> {p.title}</h3><span className="font-bold text-primary">R$ {(p.price_centavos/100).toFixed(2).replace('.',',')}</span></div>
                        <p className="text-sm text-muted-foreground">{p.description}</p>
                    </div>
                ))}
            </TabsContent>

            <TabsContent value="packages" className="space-y-3">
                {promotions.filter(p => p.type === 'package').map(p => (
                    <div key={p.id} onClick={() => handleSelectPromotion(p)} className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${formData.selectedId === p.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/50 hover:bg-muted/30'}`}>
                        <div className="flex justify-between items-start mb-2"><h3 className="font-semibold flex items-center gap-2"><Package className="w-4 h-4 text-purple-500"/> {p.title}</h3><span className="font-bold text-primary">R$ {(p.price_centavos/100).toFixed(2).replace('.',',')}</span></div>
                        <p className="text-sm text-muted-foreground">{p.description}</p>
                        <div className="mt-3 flex gap-2"><Badge variant="secondary" className="text-xs font-normal">{p.items.length} sessões</Badge>{p.days_to_expire && <Badge variant="outline" className="text-xs font-normal text-muted-foreground">Validade: {p.days_to_expire} dias</Badge>}</div>
                    </div>
                ))}
            </TabsContent>
        </Tabs>
    </div>
  );

  return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center py-6 px-4 md:px-0">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
              
              {/* Header com Progresso */}
              <div className="bg-white p-6 border-b">
                  <div className="flex justify-between items-center mb-4">
                      {step > 1 && step < 6 ? (
                          <Button variant="ghost" size="sm" className="-ml-3 h-8 text-muted-foreground" onClick={() => setStep(s => s - 1)}>
                              <ArrowLeft className="w-4 h-4 mr-1"/> Voltar
                          </Button>
                      ) : <div/>}
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Passo {step} de 5</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${(step/5)*100}%` }}/>
                  </div>
              </div>

              <div className="p-6">
                  {step === 1 && renderStep1()}
                  
                  {step === 2 && (
                      <div className="space-y-6 animate-in fade-in">
                          <h2 className="text-xl font-semibold text-center">Onde você prefere ser atendida?</h2>
                          <div className="grid gap-3">
                              {locations.map(l => (
                                  <button key={l.id} className={`w-full p-4 rounded-xl border flex items-center gap-4 transition-all ${formData.locationId === l.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'}`} onClick={() => setFormData(f => ({...f, locationId: l.id}))}>
                                      <div className={`p-2 rounded-full ${formData.locationId === l.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}><MapPin className="w-5 h-5"/></div>
                                      <span className="font-medium text-lg">{l.name}</span>
                                  </button>
                              ))}
                          </div>
                      </div>
                  )}

                  {(step === 3 || step === 4) && (
                      <div className="space-y-6 animate-in fade-in">
                          <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 text-center">
                              <span className="text-xs font-bold uppercase tracking-wider text-primary/70">Agendando</span>
                              <h3 className="font-bold text-lg text-primary mt-1">Sessão {currentSessionIndex + 1} de {orderedServices.length}</h3>
                              <p className="text-sm text-foreground/80">{currentServiceToSchedule?.name}</p>
                              {selectedPromo?.min_interval_days ? <p className="text-xs text-muted-foreground mt-2 bg-white/50 py-1 rounded inline-block px-2">Intervalo de {selectedPromo.min_interval_days} dias aplicado</p> : null}
                          </div>

                          {step === 3 && (
                              <div className="space-y-6">
                                  <div className="space-y-2">
                                      <Label>Profissional</Label>
                                      <Select value={formData.currentStaffId} onValueChange={v => setFormData(f => ({...f, currentStaffId: v, currentTime: ''}))}>
                                          <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Selecione..."/></SelectTrigger>
                                          <SelectContent>{getStaffForService(currentServiceToSchedule?.id).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                      </Select>
                                  </div>
                                  <div className="flex justify-center border rounded-xl p-2 bg-white">
                                      <Calendar mode="single" selected={formData.currentDate} onSelect={d => d && setFormData(f => ({...f, currentDate: d, currentTime: ''}))} locale={ptBR} disabled={isDateDisabled} />
                                  </div>
                              </div>
                          )}

                          {step === 4 && (
                              <div>
                                  <h3 className="font-semibold mb-4 text-center">Horários para {format(formData.currentDate!, 'dd/MM')}</h3>
                                  <div className="grid grid-cols-4 gap-2">
                                      {availableSlots.map(slot => (<Button key={slot} variant={formData.currentTime === slot ? 'default' : 'outline'} onClick={() => setFormData(f => ({...f, currentTime: slot}))} className="rounded-lg h-10">{slot}</Button>))}
                                  </div>
                                  {availableSlots.length === 0 && <p className="text-center text-muted-foreground py-8">Sem horários disponíveis.</p>}
                              </div>
                          )}
                      </div>
                  )}

                  {/* 💡 ETAPA FINAL ATUALIZADA */}
                  {step === 5 && (
                      <div className="space-y-6 animate-in fade-in">
                          <h2 className="text-xl font-bold text-center">Confirme seus dados</h2>
                          
                          <Card className="bg-muted/20 border-none p-4 space-y-3 rounded-xl">
                              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-2">Resumo do Agendamento</h3>
                              {packageSessions.map((s, idx) => (
                                  <div key={idx} className="flex justify-between text-sm bg-white p-3 rounded-lg shadow-sm">
                                      <div><span className="font-medium">{s.service.name}</span><br/><span className="text-xs text-muted-foreground">{s.staffName}</span></div>
                                      <div className="text-right font-medium">{format(s.date, 'dd/MM')} <br/> {s.time}</div>
                                  </div>
                              ))}
                              <div className="flex justify-between items-center pt-3 border-t border-dashed">
                                  <span>Total</span>
                                  <span className="text-xl font-bold text-primary">R$ {formattedPrice}</span>
                              </div>
                          </Card>

                          <div className="space-y-4">
                              <div className="space-y-2"><Label>WhatsApp</Label><Input className="h-12 rounded-lg" value={formData.customerPhone} onChange={e => setFormData(f => ({...f, customerPhone: formatPhoneDisplay(e.target.value)}))} onBlur={handlePhoneBlur} placeholder="(11) 99999-9999" disabled={isCheckingPhone}/></div>
                              <div className="space-y-2"><Label>Nome Completo</Label><Input className="h-12 rounded-lg" value={formData.customerName} onChange={e => setFormData(f => ({...f, customerName: e.target.value}))}/></div>
                              
                              {/* 💡 CAMPO DE OBSERVAÇÃO */}
                              <div className="space-y-2">
                                  <Label>Observações (Opcional)</Label>
                                  <Textarea 
                                    className="resize-none rounded-lg" 
                                    placeholder="Tem alguma preferência ou alergia?" 
                                    value={userNotes}
                                    onChange={e => setUserNotes(e.target.value)}
                                  />
                              </div>

                              {/* 💡 TERMO DE CONSENTIMENTO */}
                              <div className="flex items-start space-x-3 pt-2">
                                  <Checkbox id="terms" checked={consentGiven} onCheckedChange={(c) => setConsentGiven(c as boolean)} />
                                  <label htmlFor="terms" className="text-xs text-muted-foreground leading-snug cursor-pointer">
                                      Autorizo o processamento dos meus dados (nome e telefone) exclusivamente para a confirmação e gestão deste agendamento.
                                  </label>
                              </div>
                          </div>
                      </div>
                  )}

                  {step === 6 && (
                     <div className="py-12 text-center animate-in zoom-in">
                         <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><Check className="w-10 h-10 text-green-600"/></div>
                         <h2 className="text-2xl font-bold text-green-800 mb-2">Tudo Certo!</h2>
                         <p className="text-muted-foreground mb-8">Seu pré-agendamento foi realizado. Enviamos os detalhes de confirmação para o seu WhatsApp.</p>
                         <Button className="w-full h-12 rounded-xl" onClick={() => window.location.reload()}>Fazer Novo Agendamento</Button>
                     </div>
                  )}

                  {step < 6 && (
                      <div className="mt-8">
                          {step === 5 ? (
                              <Button 
                                onClick={handleFinalize} 
                                className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/20" 
                                disabled={!formData.customerName || !formData.customerPhone || !consentGiven || createAppointmentMutation.isPending}
                              >
                                  {createAppointmentMutation.isPending ? <Loader2 className="animate-spin mr-2"/> : "Finalizar Agendamento"}
                              </Button>
                          ) : (
                              <Button onClick={handleNextStep} disabled={step===2 && !formData.locationId || step===3 && !formData.currentDate || step===4 && !formData.currentTime} className="w-full h-12 rounded-xl text-base font-semibold">
                                  Continuar
                              </Button>
                          )}
                      </div>
                  )}
              </div>
          </div>
      </div>
  );
}
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isSameDay, addMinutes, setHours, setMinutes, isPast, getDay, parseISO, addDays, startOfDay } from "date-fns"; 
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast"; 

import api from "@/services/api";
import { appointmentsAPI, servicesAPI, staffAPI, staffShiftsAPI, staffServicesAPI, locationsAPI, customersAPI, promotionsAPI } from "@/services/api";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; 
import { Checkbox } from "@/components/ui/checkbox"; 
import { Badge } from "@/components/ui/badge";
import { 
    Loader2, Check, Clock, MapPin, 
    ArrowRight, ArrowLeft, ShoppingBag, Sparkles, SlidersHorizontal, Package, CalendarDays, User, UserPlus, Calendar as CalendarIcon, Gift, Ban, Phone,
    Info, TicketPercent
} from "lucide-react";

// --- CONFIGURAÇÃO DAS IMAGENS ---
const IMAGES = {
    logo: "/img/logo.png", 
    bottomCover: "/img/fundo_maos.png", 
};

// --- INTERFACES ---
interface Service { 
    id: string; 
    name: string; 
    price_centavos: number; 
    default_duration_min: number; 
    category: string; 
}

interface Staff { 
    id: string; 
    name: string; 
    active?: boolean; 
}

interface Location { 
    id: string; 
    name: string; 
}

interface StaffShift { 
    staff_id: string; 
    location_id: string; 
    weekday: number; 
    start_time: string; 
    end_time: string; 
}

interface StaffService { 
    staff_id: string; 
    service_id: string; 
}

interface Appointment { 
    id: string; 
    staff: string; 
    start_time: string; 
    end_time: string; 
    status: string; 
}

interface Promotion { 
    id: string; 
    title: string; 
    type: 'combo' | 'package'; 
    price_centavos: number; 
    items: {
        service: string; 
        service_id?: string; 
        quantity: number;
        custom_interval?: number;
        is_linked_to_previous?: boolean;
    }[]; 
    description?: string; 
    min_interval_days?: number; 
    suggested_interval_days?: number; 
    days_to_expire?: number;
    active?: boolean;
}

// Interface para Parceiro
interface Partner {
    id: string;
    name: string;
    slug: string;
    discount_percent: number;
    active: boolean;
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
  const { toast } = useToast(); 

  // 🔥 PARCERIA: Recupera slug da URL e busca dados
  const searchParams = new URLSearchParams(window.location.search);
  const partnerSlug = searchParams.get('parceria');

  const { data: activePartner } = useQuery<Partner>({
    queryKey: ['partner', partnerSlug],
    queryFn: () => api.get(`/partners/?slug=${partnerSlug}`).then((res: any) => res.data[0]),
    enabled: !!partnerSlug
  });

  useEffect(() => {
      if (activePartner) {
          toast({ 
              title: "Parceria Ativa!", 
              description: `Você tem ${activePartner.discount_percent}% de desconto em serviços avulsos com a ${activePartner.name}.`,
              duration: 5000
          });
      }
  }, [activePartner, toast]);
  
  // --- ESTADOS ---
  const [step, setStep] = useState(0); 
  
  useEffect(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const [viewMode, setViewMode] = useState<'services' | 'combos' | 'packages' | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0);
  const [scheduledSessions, setScheduledSessions] = useState<any[]>([]); 

  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [userNotes, setUserNotes] = useState("");

  const [hasReferral, setHasReferral] = useState(false);
  const [referrerPhone, setReferrerPhone] = useState("");
  const [referrerName, setReferrerName] = useState("");
  const [isCheckingReferrer, setIsCheckingReferrer] = useState(false);

  const [isExistingCustomer, setIsExistingCustomer] = useState(false);

  const [formData, setFormData] = useState({
    selectedId: '', 
    type: 'service' as 'service' | 'combo' | 'package',
    items: [] as {service_id: string, quantity: number}[],
    staffMapping: {} as Record<number, string>,
    currentDate: undefined as Date | undefined,
    currentTime: '',
    currentTimeEnd: '',
    locationId: '', 
    customerId: '', 
    customerName: '', 
    customerPhone: '', 
    customerEmail: ''
  });

  // --- QUERIES ---
  const { data: services = [] } = useQuery<Service[]>({ queryKey: ['services'], queryFn: servicesAPI.getAll });
  const { data: promotions = [] } = useQuery<Promotion[]>({ queryKey: ['promotions'], queryFn: promotionsAPI.getAll });
  const { data: allStaff = [] } = useQuery<Staff[]>({ queryKey: ['staff'], queryFn: staffAPI.getAll });
  const { data: staffServices = [] } = useQuery<StaffService[]>({ queryKey: ['staffServices'], queryFn: staffServicesAPI.getAll });
  const { data: staffShifts = [] } = useQuery<StaffShift[]>({ queryKey: ['staffShifts'], queryFn: staffShiftsAPI.getAll });
  const { data: allAppointments = [] } = useQuery<Appointment[]>({ queryKey: ['appointments'], queryFn: appointmentsAPI.getAll }); 
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ['locations'], queryFn: locationsAPI.getAll });

  const safeServices = Array.isArray(services) ? services : [];
  const safePromotions = Array.isArray(promotions) ? promotions : [];
  const safeStaff = Array.isArray(allStaff) ? allStaff : [];
  const safeStaffServices = Array.isArray(staffServices) ? staffServices : [];
  const safeStaffShifts = Array.isArray(staffShifts) ? staffShifts : [];
  const safeAppointments = Array.isArray(allAppointments) ? allAppointments : [];
  const safeLocations = Array.isArray(locations) ? locations : [];

  // --- MEMOS ---
  const categories = useMemo(() => {
      const allCats = safeServices.map(s => s.category).filter(Boolean);
      return ["Todos", ...Array.from(new Set(allCats)).sort()];
  }, [safeServices]);

  const orderedServices = useMemo(() => {
      if (!formData.items || !Array.isArray(formData.items)) return [];
      return formData.items.flatMap(item => {
          const srv = safeServices.find(s => s.id === item.service_id);
          return srv ? Array(item.quantity).fill(srv) : [];
      });
  }, [formData.items, safeServices]);

  const selectedPromo = safePromotions.find(p => p.id === formData.selectedId);

  const originalTotalPrice = useMemo(() => {
      return orderedServices.reduce((sum, s) => sum + (s.price_centavos || 0), 0);
  }, [orderedServices]);

  // 🔥 CÁLCULO DE PREÇO (Com desconto de Parceria para Avulsos)
  const totalPrice = useMemo(() => {
      let total = 0;
      
      // 1. Preço Base
      if (selectedPromo) {
          total = selectedPromo.price_centavos;
      } else {
          total = originalTotalPrice;
      }

      // 2. Aplica desconto da parceria APENAS em serviços avulsos
      if (activePartner && formData.type === 'service') {
          const discount = total * (activePartner.discount_percent / 100);
          total = total - discount;
      }

      return Math.round(total);
  }, [selectedPromo, originalTotalPrice, activePartner, formData.type]);

  const formattedPrice = (totalPrice / 100).toFixed(2).replace('.', ',');
  const formattedOriginalPrice = (originalTotalPrice / 100).toFixed(2).replace('.', ',');
  
  const selectedLocation = useMemo(() => safeLocations.find(l => l.id === formData.locationId), [formData.locationId, safeLocations]);

  // --- LÓGICA DE AGRUPAMENTO (PARA O RESUMO) ---
  const groupedSessions = useMemo(() => {
      if (formData.type === 'combo') {
          let totalDuration = 0;
          const items = orderedServices.map((s, idx) => {
              totalDuration += s.default_duration_min;
              return {
                  name: s.name,
                  staffName: safeStaff.find(st => st.id === formData.staffMapping[idx])?.name,
                  duration: s.default_duration_min,
              };
          });
          
          if (!formData.currentTime || !formData.currentDate) {
              return [{ key: 'combo-pending', date: formData.currentDate || new Date(), time: '', endTimePrediction: '', items: items, isFuture: false }];
          }

          const [h, m] = formData.currentTime.split(':').map(Number);
          const start = setMinutes(setHours(formData.currentDate, h), m);
          const end = addMinutes(start, totalDuration);
          
          return [{
              key: 'combo-single', 
              date: formData.currentDate, 
              time: formData.currentTime, 
              endTimePrediction: format(end, 'HH:mm'), 
              items: items,
              isFuture: false
          }];
      } else {
          const groups: any[] = [];
          
          const sortedSessions = [...scheduledSessions].sort((a,b) => a.date.getTime() - b.date.getTime());

          sortedSessions.forEach((session, idx) => {
              const dateKey = format(session.date, 'yyyy-MM-dd') + '-' + session.time;
              let group = groups.find(g => g.key === dateKey);
              
              if (!group) {
                  const [h, m] = session.time.split(':').map(Number);
                  const start = setMinutes(setHours(session.date, h), m);
                  const end = addMinutes(start, session.service.default_duration_min);
                  
                  group = { 
                      key: dateKey, 
                      date: session.date, 
                      time: session.time, 
                      endTimePrediction: format(end, 'HH:mm'), 
                      items: [],
                      isFuture: idx > 0 
                  };
                  groups.push(group);
              }
              
              group.items.push({
                  name: session.service.name, 
                  staffName: session.staffName, 
                  duration: session.service.default_duration_min
              });
          });
          
          return groups;
      }
  }, [formData, orderedServices, scheduledSessions, safeStaff, selectedPromo]);

  const handleSelectMode = (mode: 'services' | 'combos' | 'packages') => { 
      const targetType = mode === 'services' ? 'service' : (mode === 'combos' ? 'combo' : 'package');

      if (formData.type === targetType && formData.items.length > 0) {
          setViewMode(mode);
          setStep(1);
          return;
      }

      setViewMode(mode); 
      setStep(1); 
      setFormData(f => ({ 
          ...f, 
          items: [], 
          selectedId: '', 
          type: targetType, 
          staffMapping: {},
          currentDate: undefined, 
          currentTime: '', 
          currentTimeEnd: ''
      })); 
  };

  const handleToggleService = (service: Service) => { 
      setFormData(prev => { 
          const exists = prev.items.find(i => i.service_id === service.id); 
          let newItems; 
          if (exists) { 
              newItems = prev.items.filter(i => i.service_id !== service.id); 
          } else { 
              newItems = [...prev.items, { service_id: service.id, quantity: 1 }]; 
          } 
          return { ...prev, type: 'service', selectedId: '', items: newItems, staffMapping: {} }; 
      }); 
  };

  const handleSelectPromotion = (promo: Promotion) => { 
      const items = promo.items || []; 
      const mappedItems = items.map(item => ({ service_id: item.service || item.service_id || '', quantity: item.quantity })); 
      setFormData(f => ({ ...f, selectedId: promo.id, type: promo.type, items: mappedItems, staffMapping: {}, currentDate: undefined, currentTime: '', currentTimeEnd: '' })); 
      setCurrentSessionIndex(0); 
      setScheduledSessions([]); 
      setStep(2); 
  };

  const handleStaffSelect = (idx: number, staffId: string) => { 
      setFormData(f => ({ ...f, staffMapping: { ...f.staffMapping, [idx]: staffId }, currentTime: '' })); 
  };

  const getStaffForService = (serviceId: string) => { 
      if (!formData.locationId) return []; 
      const staffIds = new Set(safeStaffServices.filter(ss => ss.service_id === serviceId).map(ss => ss.staff_id)); 
      const locationStaffIds = new Set(safeStaffShifts.filter(s => s.location_id === formData.locationId).map(s => s.staff_id)); 
      return safeStaff.filter(s => staffIds.has(s.id) && locationStaffIds.has(s.id) && s.active !== false); 
  };

  const isDateDisabled = (date: Date) => { 
      if (isPast(date) && !isSameDay(date, new Date())) return true; 
      
      const jsDay = getDay(date); 
      const dbDay = jsDay === 0 ? 7 : jsDay; 
      
      if (formData.type === 'combo' || formData.type === 'package') { 
          const staffId = formData.staffMapping[0];
          if (staffId) {
              const hasShift = safeStaffShifts.some(s => s.staff_id === staffId && s.location_id === formData.locationId && s.weekday === dbDay); 
              return !hasShift;
          }
          return false;
      } else { 
          const staffId = formData.staffMapping[currentSessionIndex]; 
          if (staffId) { 
              const hasShift = safeStaffShifts.some(s => s.staff_id === staffId && s.location_id === formData.locationId && s.weekday === dbDay); 
              if (!hasShift) return true; 
          } 
      } 
      return false; 
  };

  const availableSlots = useMemo(() => { 
      if (!formData.currentDate) return []; 
      const jsDay = getDay(formData.currentDate); 
      const dbDay = jsDay === 0 ? 7 : jsDay; 
      
      if (formData.type === 'combo') { 
          if (Object.keys(formData.staffMapping).length < orderedServices.length) return []; 
          
          const firstStaffId = formData.staffMapping[0]; 
          const firstShifts = safeStaffShifts.filter(s => s.staff_id === firstStaffId && s.weekday === dbDay && s.location_id === formData.locationId); 
          const validSlots = new Set<string>(); 
          
          firstShifts.forEach(shift => { 
              const [sh, sm] = shift.start_time.split(':').map(Number); 
              const [eh, em] = shift.end_time.split(':').map(Number); 
              let current = setMinutes(setHours(formData.currentDate!, sh), sm); 
              const shiftEnd = setMinutes(setHours(formData.currentDate!, eh), em); 
              
              if (isSameDay(current, new Date()) && current < new Date()) {
                current = addMinutes(current, Math.ceil((new Date().getHours()*60 + new Date().getMinutes() - (sh*60+sm))/30) * 30); 
              }
              
              while (current < shiftEnd) { 
                  let chainTime = current; 
                  let isChainValid = true; 
                  
                  for (let i = 0; i < orderedServices.length; i++) { 
                      const srv = orderedServices[i]; 
                      const staffId = formData.staffMapping[i]; 
                      const duration = srv.default_duration_min || 30; 
                      const serviceEnd = addMinutes(chainTime, duration); 
                      
                      const hasShift = safeStaffShifts.some(s => 
                        s.staff_id === staffId && 
                        s.weekday === dbDay && 
                        s.location_id === formData.locationId && 
                        s.start_time <= format(chainTime, 'HH:mm:ss') && 
                        s.end_time >= format(serviceEnd, 'HH:mm:ss')
                      ); 

                      if (!hasShift) { isChainValid = false; break; } 
                      
                      const hasConflict = safeAppointments.some(a => { 
                          if (a.status === 'cancelled' || a.staff !== staffId) return false; 
                          const as = parseISO(a.start_time); 
                          const ae = parseISO(a.end_time); 
                          return (chainTime < ae && serviceEnd > as); 
                      }); 
                      
                      if (hasConflict) { isChainValid = false; break; } 
                      
                      chainTime = serviceEnd; 
                  } 
                  
                  if (isChainValid) {
                      validSlots.add(JSON.stringify({ 
                          start: format(current, 'HH:mm'), 
                          end: format(chainTime, 'HH:mm') 
                      })); 
                  }
                  
                  current = addMinutes(current, 30); 
              } 
          }); 
          return Array.from(validSlots).map(s => JSON.parse(s)).sort((a: any, b: any) => a.start.localeCompare(b.start)); 
      } 
      
      const staffId = formData.staffMapping[currentSessionIndex]; 
      const service = orderedServices[currentSessionIndex]; 
      if (!staffId || !service) return []; 
      
      const shifts = safeStaffShifts.filter(s => s.staff_id === staffId && s.weekday === dbDay && s.location_id === formData.locationId); 
      const validSlots = new Set<string>(); 
      
      shifts.forEach(shift => { 
          const [sh, sm] = shift.start_time.split(':').map(Number); 
          const [eh, em] = shift.end_time.split(':').map(Number); 
          let current = setMinutes(setHours(formData.currentDate!, sh), sm); 
          const shiftEnd = setMinutes(setHours(formData.currentDate!, eh), em); 
          
          if (isSameDay(current, new Date()) && current < new Date()) current = addMinutes(current, Math.ceil((new Date().getHours()*60 + new Date().getMinutes() - (sh*60+sm))/30) * 30); 
          
          while (current < shiftEnd) { 
              const duration = service.default_duration_min || 30; 
              const slotEnd = addMinutes(current, duration); 
              
              const conflict = safeAppointments.some(a => { 
                  if (a.status === 'cancelled' || a.staff !== staffId) return false; 
                  const as = parseISO(a.start_time); 
                  const ae = parseISO(a.end_time); 
                  return (current < ae && slotEnd > as); 
              }); 
              
              const sessionConflict = scheduledSessions.some(s => { 
                  if (s.staffId !== staffId) return false; 
                  if (isSameDay(s.date, formData.currentDate!)) { 
                      const sStart = setMinutes(setHours(s.date, parseInt(s.time.split(':')[0])), parseInt(s.time.split(':')[1])); 
                      const sEnd = addMinutes(sStart, s.service.default_duration_min || 30); 
                      return (current < sEnd && slotEnd > sStart); 
                  } 
                  return false; 
              }); 
              
              if (!conflict && !sessionConflict && slotEnd <= shiftEnd) validSlots.add(JSON.stringify({ start: format(current, 'HH:mm'), end: format(slotEnd, 'HH:mm') })); 
              current = addMinutes(current, 30); 
          } 
      }); 
      return Array.from(validSlots).map(s => JSON.parse(s)).sort((a: any, b: any) => a.start.localeCompare(b.start)); 
  }, [formData.currentDate, formData.staffMapping, safeStaffShifts, safeAppointments, orderedServices, scheduledSessions, formData.type, currentSessionIndex, formData.locationId]);

  const handlePhoneBlur = async () => { 
      const raw = cleanPhone(formData.customerPhone); 
      if (raw.length < 10) return; 
      setIsCheckingPhone(true); 
      try { 
          const res = await customersAPI.checkPhone(raw.startsWith('55') ? raw : `55${raw}`); 
          if (res.exists) { 
              setFormData(f => ({
                  ...f, 
                  customerName: res.name, 
                  customerEmail: res.email || f.customerEmail,
                  customerId: res.id 
              })); 
              setIsExistingCustomer(true);
              setHasReferral(false); 
              setReferrerPhone("");
              setReferrerName("");
              toast({ title: `Que bom te ver de novo, ${res.name.split(' ')[0]}!` }); 
          } else { 
              setIsExistingCustomer(false); 
              toast({ title: "Bem-vinda!", description: "Complete seu cadastro." }); 
          } 
      } catch (e) { 
      } finally { 
          setIsCheckingPhone(false); 
      } 
  };

  const handleReferrerBlur = async () => { 
      const raw = cleanPhone(referrerPhone); 
      if (raw.length < 10) return; 
      setIsCheckingReferrer(true); 
      setReferrerName(""); 
      try { 
          const res = await customersAPI.checkPhone(raw.startsWith('55') ? raw : `55${raw}`); 
          if (res.exists) { 
              setReferrerName(res.name); 
              toast({ title: `Indicação confirmada: ${res.name}` }); 
          } else { 
              toast({ title: "Número não encontrado", description: "Verifique o número digitado.", variant: "destructive" }); 
              setReferrerName(""); 
          } 
      } catch (e) { 
          toast({ title: "Erro ao verificar", variant: "destructive" }); 
      } finally { 
          setIsCheckingReferrer(false); 
      } 
  };
  
  const handleNextStep = () => { 
      if (step === 2 && !formData.locationId) return toast({ title: "Selecione a unidade.", variant: "destructive" }); 
      if (step === 3) { 
          if (!formData.currentDate) return toast({ title: "Selecione a data.", variant: "destructive" }); 
          if (formData.type === 'combo') { 
              if (!orderedServices.every((_, idx) => !!formData.staffMapping[idx])) return toast({ title: "Selecione profissionais.", variant: "destructive" }); 
          } else { 
              if (!formData.staffMapping[0]) return toast({ title: "Selecione profissional.", variant: "destructive" }); 
          } 
      } 
      if (step === 4 && !formData.currentTime) return toast({ title: "Selecione horário.", variant: "destructive" }); 
      
      if (step === 4) { 
          if (formData.type === 'combo') { 
              setStep(5); 
          } else if (formData.type === 'package') {
              const calculatedSessions = [];
              let currentDate = formData.currentDate!;
              const [h, m] = formData.currentTime.split(':').map(Number);
              const primaryStaffId = formData.staffMapping[0];
              const primaryStaffName = safeStaff.find(s => s.id === primaryStaffId)?.name;

              for (let i = 0; i < orderedServices.length; i++) {
                  const srv = orderedServices[i];
                  const ruleItem = selectedPromo?.items[i]; 
                  
                  if (i > 0) {
                      if (ruleItem?.is_linked_to_previous) {
                          // Mantém a mesma data
                      } else {
                          const daysToAdd = ruleItem?.custom_interval && ruleItem.custom_interval > 0 ? ruleItem.custom_interval : 7;
                          currentDate = addDays(currentDate, daysToAdd);
                          if (getDay(currentDate) === 0) currentDate = addDays(currentDate, 1);
                      }
                  }

                  const startDt = setMinutes(setHours(currentDate, h), m);
                  
                  calculatedSessions.push({
                      service: srv,
                      staffId: primaryStaffId,
                      staffName: primaryStaffName,
                      date: currentDate,
                      time: format(startDt, 'HH:mm'),
                      endTime: ''
                  });
              }
              setScheduledSessions(calculatedSessions);
              setStep(5);

          } else { 
              const newSession = { 
                  service: orderedServices[currentSessionIndex], 
                  staffId: formData.staffMapping[currentSessionIndex], 
                  staffName: safeStaff.find(s => s.id === formData.staffMapping[currentSessionIndex])?.name, 
                  date: formData.currentDate!, 
                  time: formData.currentTime, 
                  endTime: formData.currentTimeEnd 
              }; 
              setScheduledSessions([...scheduledSessions, newSession]); 
              if (currentSessionIndex < orderedServices.length - 1) { 
                  setCurrentSessionIndex(prev => prev + 1); 
                  setFormData(f => ({ ...f, currentDate: undefined, currentTime: '', currentTimeEnd: '' })); 
                  setStep(3); 
              } else { 
                  setStep(5); 
              } 
          } 
      } else { 
          setStep(s => s + 1); 
      } 
  };
  
  const createAppointmentMutation = useMutation({ 
      mutationFn: async (payload: any) => appointmentsAPI.create(payload), 
      onSuccess: () => {}, 
      onError: (err: any) => {
          const responseError = err.response?.data?.error;
          let friendlyMessage = "Não foi possível concluir o agendamento.";
          if (responseError) friendlyMessage = responseError;
          toast({ title: "Atenção", description: friendlyMessage, variant: "destructive" });
      } 
  });
  
  const handleFinalize = async () => { 
    if (!formData.customerName || !formData.customerPhone) return toast({ title: "Preencha seus dados.", variant: "destructive" }); 
    if (!formData.customerEmail) return toast({ title: "Informe seu e-mail.", variant: "destructive" }); 
    if (!consentGiven) return toast({ title: "Aceite os termos.", variant: "destructive" }); 
    
    if (isExistingCustomer && hasReferral) {
        setHasReferral(false);
        return toast({ title: "Indicações apenas para novos clientes.", variant: "destructive" });
    }

    try { 
        let referralNote = "";
        let notesSuffix = "";
        
        // 🔥 INSERE PARCEIRO NAS NOTAS
        if (activePartner && formData.type === 'service') {
            notesSuffix += ` - Parceria: ${activePartner.name} (${activePartner.discount_percent}% OFF)`;
        }

        if (hasReferral && referrerName) {
            referralNote = `Indicado por: ${referrerName}`;
            notesSuffix += ` - ${referralNote}`;
        }

        const extraData = hasReferral && referrerPhone ? { 
            referrer_phone: `55${cleanPhone(referrerPhone)}`,
            customer_notes: referralNote 
        } : {}; 

        if (formData.customerId && referralNote) {
            try { await customersAPI.update(formData.customerId, { notes: referralNote }); } catch (err) {}
        }
        
        const commonData = { 
            customer_name: formData.customerName, 
            customer_phone: `55${cleanPhone(formData.customerPhone)}`, 
            customer_email: formData.customerEmail, 
            location: formData.locationId, 
            status: 'pending', 
            ...extraData 
        }; 

        if (formData.type === 'combo') { 
            let chainTime = setMinutes(setHours(formData.currentDate!, parseInt(formData.currentTime.split(':')[0])), parseInt(formData.currentTime.split(':')[1])); 
            const comboTotal = totalPrice;

            for (let i = 0; i < orderedServices.length; i++) { 
                const srv = orderedServices[i]; 
                const duration = srv.default_duration_min || 30; 
                const endTime = addMinutes(chainTime, duration); 
                const finalNotes = `Combo: ${selectedPromo?.title} (Item ${i+1}/${orderedServices.length}). ${userNotes}${notesSuffix}`;
              
                await createAppointmentMutation.mutateAsync({ 
                    ...commonData, 
                    staff: formData.staffMapping[i], 
                    service: srv.id, 
                    start_time: toLocalISOString(chainTime), 
                    end_time: toLocalISOString(endTime), 
                    notes: finalNotes,
                    final_amount_centavos: i === 0 ? comboTotal : 0 
                }); 
                
                chainTime = endTime; 
            } 
        } else { 
            const packageTotal = totalPrice; 

            for (let i = 0; i < scheduledSessions.length; i++) { 
                const s = scheduledSessions[i]; 
                const [h, m] = s.time.split(':').map(Number); 
                const start = setMinutes(setHours(s.date, h), m); 
                const end = addMinutes(start, s.service.default_duration_min || 30); 
              
                let finalNotes = "";
                if (formData.type === 'package') {
                    const promoTitle = selectedPromo?.title || "Pacote";
                    const tag = `[Pacote: ${promoTitle} - Sessão ${i+1}/${scheduledSessions.length}]`;
                    const extra = i === 0 ? `${userNotes}${notesSuffix}` : `Serviço: ${s.service.name}`;
                    finalNotes = `${tag} ${extra}`;
                } else {
                    finalNotes = `Avulso: ${s.service.name}. ${userNotes}${notesSuffix}`;
                }
              
                const itemPrice = formData.type === 'package' 
                    ? (i === 0 ? packageTotal : 0)
                    : (s.service.price_centavos || 0);

                // 🔥 Se for avulso com parceria, o preço já calculado (com desconto) vai aqui
                const finalPriceToSave = formData.type === 'service' ? totalPrice : itemPrice;

                await createAppointmentMutation.mutateAsync({ 
                    ...commonData, 
                    staff: s.staffId, 
                    service: s.service.id, 
                    start_time: toLocalISOString(start), 
                    end_time: toLocalISOString(end), 
                    notes: finalNotes,
                    final_amount_centavos: finalPriceToSave
                }); 
            } 
        }
        setStep(6); 
    } catch (error) { 
    } 
  };

  const renderStep0 = () => (
      <div className="flex flex-col min-h-screen w-full max-w-md mx-auto relative bg-[#FAF7F5] font-sans overflow-hidden font-inter">
          <div className="absolute bottom-0 left-0 w-full z-10 pointer-events-none">
            <img src={IMAGES.bottomCover} alt="Mãos" className="w-full h-auto object-cover opacity-80" />
          </div>
          <div className="relative z-20 flex flex-col items-center px-6 pt-12 pb-10 flex-1 w-full">
              <div className="text-center space-y-2 mb-8 w-full animate-in slide-in-from-top-4 duration-700">
                  <img src={IMAGES.logo} alt="Cheias de Charme" className="h-24 mx-auto mb-4 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
                  <h1 className="text-3xl md:text-4xl font-extrabold text-[#4A4A4A] tracking-tight font-inter">Agendamento Online</h1>
                  <p className="text-[#9B9089] font-inter italic text-sm font-light tracking-wide">Selecione uma opção para começar</p>
                  
                  {/* 🔥 BADGE DE PARCERIA NA CAPA */}
                  {activePartner && (
                      <div className="mt-4 animate-in fade-in zoom-in bg-white/80 backdrop-blur-sm border border-[#C6A87C] text-[#C6A87C] px-4 py-2 rounded-full shadow-sm flex items-center gap-2">
                          <TicketPercent className="w-4 h-4" />
                          <span className="text-xs font-bold uppercase tracking-wider">Parceria: {activePartner.name}</span>
                      </div>
                  )}
              </div>
              <div className="flex flex-col space-y-5 w-full">
                  <button onClick={() => handleSelectMode('services')} className="group relative w-full bg-[#C7A86B]/70 rounded-[10px] p-5 shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] hover:shadow-lg hover:scale-[1.02] transition-all duration-300 flex flex-col items-center text-center space-y-1 border border-[#C7A86B]/50">
                      
                      {/* 🔥 BADGE 10% (ou a % do parceiro) NO BOTÃO AVULSO */}
                      {activePartner && (
                          <div className="absolute top-4 right-4 bg-[#FF5A5F] text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-sm animate-pulse">
                              {activePartner.discount_percent}% OFF
                          </div>
                      )}

                      <h3 className="text-xl font-extrabold text-[#554B44] font-inter">Serviços Avulsos</h3>
                      <p className="text-[11px] text-[#7A6C5D] italic font-medium whitespace-nowrap">Escolha serviços individuais para o seu cuidado diário.</p>
                  </button>
                  <button onClick={() => handleSelectMode('combos')} className="group relative w-full bg-[#C7A86B]/70 rounded-[10px] p-5 shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] hover:shadow-lg hover:scale-[1.02] transition-all duration-300 flex flex-col items-center text-center space-y-1 border border-[#C7A86B]/50">
                      <div className="absolute top-4 right-4 bg-[#FF5A5F] text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-sm animate-pulse">5%</div>
                      <h3 className="text-xl font-extrabold text-[#554B44] font-inter">Combos Especiais</h3>
                      <p className="text-[11px] text-[#7A6C5D] italic font-medium whitespace-nowrap">Combine serviços e garanta um desconto especial.</p>
                  </button>
                  <button onClick={() => handleSelectMode('packages')} className="group relative w-full bg-[#C7A86B]/70 rounded-[10px] p-5 shadow-[0_4px_4px_0_rgba(0,0,0,0.25)] hover:shadow-lg hover:scale-[1.02] transition-all duration-300 flex flex-col items-center text-center space-y-1 border border-[#C7A86B]/50">
                      <div className="absolute top-4 right-4 bg-[#FF5A5F] text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-sm animate-pulse">8%</div>
                      <h3 className="text-xl font-extrabold text-[#554B44] font-inter">Pacote Recorrente</h3>
                      <p className="text-[11px] text-[#7A6C5D] italic font-medium whitespace-nowrap">Garanta suas sessões com o melhor preço fixo.</p>
                  </button>
              </div>
          </div>
      </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 font-sans">
        <div className="flex items-center gap-3 mb-6 border-b border-stone-100 pb-4">
            <Button variant="ghost" size="icon" onClick={() => setStep(0)} className="rounded-full h-8 w-8 text-stone-400 hover:text-[#C6A87C] hover:bg-stone-50"><ArrowLeft className="w-4 h-4"/></Button>
            <h2 className="text-xl font-bold text-stone-800 font-inter">{viewMode === 'services' ? 'Selecione os Serviços' : viewMode === 'combos' ? 'Selecione o Combo' : 'Selecione o Plano'}</h2>
        </div>
        {viewMode === 'services' && (
            <>
                <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar mb-4 items-center">
                    <SlidersHorizontal className="w-4 h-4 text-stone-400 flex-shrink-0 mr-2" />
                    {categories.map(cat => (
                        <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-300 ${selectedCategory === cat ? 'bg-[#C6A87C] text-white shadow-md' : 'bg-white text-stone-500 border border-stone-200 hover:border-[#C6A87C] hover:text-[#C6A87C]'}`}>{cat}</button>
                    ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-28">
                    {safeServices.filter(s => selectedCategory === "Todos" || s.category === selectedCategory).map(s => {
                        const isSelected = formData.items.some(i => i.service_id === s.id);
                        return (
                            <div key={s.id} onClick={() => handleToggleService(s)} className={`group relative bg-white rounded-[1.5rem] p-5 border cursor-pointer transition-all duration-300 hover:shadow-md flex flex-col justify-between ${isSelected ? 'border-[#C6A87C] ring-1 ring-[#C6A87C] bg-[#FAF8F5]' : 'border-stone-200 hover:border-[#C6A87C]'}`}>
                                <div className="flex justify-between items-start mb-3 gap-4">
                                    <h3 className={`text-base font-bold font-inter leading-tight ${isSelected ? 'text-[#C6A87C]' : 'text-stone-800'}`}>{s.name}</h3>
                                    <div className="flex flex-col items-end">
                                        <span className="font-bold text-base text-[#C6A87C] whitespace-nowrap">R$ {(s.price_centavos/100).toFixed(2).replace('.',',')}</span>
                                        {/* 🔥 MOSTRA DESCONTO NOS CARDS */}
                                        {activePartner && (
                                            <Badge className="bg-[#C6A87C]/10 text-[#C6A87C] text-[9px] hover:bg-[#C6A87C]/20 border-none px-1 py-0 h-4">
                                                -{activePartner.discount_percent}% OFF
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-stone-400 mb-5 font-medium">
                                    <span className="flex items-center gap-1.5 bg-stone-50 px-2 py-1 rounded-md"><Clock className="w-3.5 h-3.5"/> {s.default_duration_min} min</span>
                                </div>
                                <div className={`w-full py-2.5 rounded-xl border font-bold text-xs uppercase tracking-widest text-center transition-all duration-300 ${isSelected ? 'bg-[#C6A87C] text-white border-[#C6A87C] shadow-sm' : 'border-[#C6A87C] text-[#C6A87C] bg-white group-hover:bg-[#C6A87C] group-hover:text-white'}`}>{isSelected ? 'Selecionado' : 'Agendar'}</div>
                            </div>
                        )
                    })}
                </div>
                {formData.items.length > 0 && (<div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4 animate-in slide-in-from-bottom-10 fade-in z-50"><Button onClick={() => { setCurrentSessionIndex(0); setScheduledSessions([]); setStep(2); }} className="w-full h-16 rounded-full bg-[#1A1A1A] hover:bg-black text-white shadow-2xl flex justify-between items-center px-8 font-inter"><span className="text-sm font-medium flex items-center gap-2"><ShoppingBag className="w-4 h-4"/> {formData.items.length} itens • R$ {formattedPrice}</span><span className="flex items-center font-bold">Continuar <ArrowRight className="ml-2 w-4 h-4"/></span></Button></div>)}
            </>
        )}
        {(viewMode === 'combos' || viewMode === 'packages') && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {safePromotions.filter(p => viewMode === 'combos' ? p.type === 'combo' : p.type === 'package').map(p => (
                    <div key={p.id} onClick={() => handleSelectPromotion(p)} className="group relative bg-white rounded-[2rem] p-6 border border-stone-100 cursor-pointer transition-all hover:shadow-lg">
                        <div className="mb-2"><div className="flex items-center gap-2 mb-1"><h3 className="text-lg font-bold font-inter text-stone-800">{p.title}</h3>{p.active && <Badge className="bg-[#C6A87C] hover:bg-[#B08D55] text-[9px] h-5 tracking-widest uppercase">{viewMode === 'combos' ? '5% OFF' : '8% OFF'}</Badge>}</div><p className="text-[11px] text-stone-400 max-w-[250px] line-clamp-2">{p.description}</p></div>
                        <div className="flex items-center gap-4 text-xs text-stone-500 mb-6 font-medium mt-3"><span className="flex items-center gap-1"><Sparkles className="w-3 h-3 text-[#C6A87C]"/> {p.items?.length || 0} Procedimentos</span><span className="flex items-center gap-1"><CalendarDays className="w-3 h-3 text-[#C6A87C]"/> {viewMode === 'combos' ? '1 Sessão' : '4 Sessões'}</span></div>
                        <div className="mb-4"><span className="font-bold text-lg text-[#C6A87C]">R$ {(p.price_centavos/100).toFixed(2).replace('.',',')}</span></div>
                        <div className="w-full py-3 rounded-xl border border-[#C6A87C] text-[#C6A87C] font-bold text-sm uppercase tracking-widest text-center transition-all hover:bg-[#C6A87C] hover:text-white">AGENDAR</div>
                    </div>
                ))}
            </div>
        )}
    </div>
  );

  return (
      <div className={`min-h-screen bg-[#FAF7F5] flex flex-col items-center ${step === 0 ? 'p-0' : 'py-6 px-4'} md:px-0 font-sans selection:bg-[#C6A87C] selection:text-white pb-0 relative`}>
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,800;1,300;1,400&display=swap');
            .font-sans { font-family: 'Inter', sans-serif; }
            .font-inter { font-family: 'Inter', sans-serif; }
            .no-scrollbar::-webkit-scrollbar { display: none; }
            .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          `}</style>
          
          {step === 0 ? renderStep0() : (
              <div className="w-full max-w-lg md:max-w-2xl lg:max-w-4xl animate-in fade-in slide-in-from-bottom-8 duration-500 pb-12">
                  <Card className="bg-white border-none shadow-xl rounded-[2rem] overflow-hidden relative">
                      <div className="absolute top-0 left-0 w-full h-1 bg-stone-100"><div className="h-full bg-[#C6A87C] transition-all duration-700 ease-out" style={{ width: `${(step/5)*100}%` }}/></div>
                      <div className="p-6 md:p-8">
                          {step === 1 && renderStep1()}
                          {step === 2 && (
                              <div className="space-y-8 font-inter">
                                  {/* HEADER COM VOLTAR (NOVO) */}
                                  <div className="flex items-center mb-6 relative">
                                      <Button variant="ghost" size="icon" onClick={() => setStep(1)} className="absolute left-0 rounded-full h-8 w-8 text-stone-400 hover:text-[#C6A87C] hover:bg-stone-50"><ArrowLeft className="w-4 h-4"/></Button>
                                      <h2 className="text-xl font-bold text-center text-stone-800 w-full">Qual unidade prefere?</h2>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {safeLocations.map(l => (
                                          <button key={l.id} className={`group relative w-full p-6 bg-white border border-stone-200 rounded-[1.5rem] flex items-center gap-6 hover:border-[#C6A87C] hover:shadow-lg transition-all duration-300 ${formData.locationId === l.id ? 'border-[#C6A87C] ring-1 ring-[#C6A87C] bg-[#FAF8F5]' : ''}`} onClick={() => { setFormData(f => ({...f, locationId: l.id})); setStep(3); }}>
                                              <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors duration-300 ${formData.locationId === l.id ? 'bg-[#C6A87C]' : 'bg-[#FAF8F5] group-hover:bg-[#C6A87C]'}`}><MapPin className={`w-6 h-6 transition-colors duration-300 ${formData.locationId === l.id ? 'text-white' : 'text-[#C6A87C] group-hover:text-white'}`} /></div>
                                              <div className="text-left flex-1"><h3 className="text-lg font-bold text-stone-800 font-inter group-hover:text-[#C6A87C] transition-colors">{l.name}</h3><p className="text-xs text-stone-400 mt-1 font-medium tracking-wide">Clique para selecionar</p></div>
                                          </button>
                                      ))}
                                  </div>
                                  <div className="flex justify-center"><Button variant="ghost" size="sm" onClick={() => setStep(1)} className="text-stone-400 hover:text-stone-800 tracking-wide text-xs uppercase font-bold">Voltar</Button></div>
                              </div>
                          )}
                          {(step === 3 || step === 4) && (
                              <div className="space-y-8 font-inter">
                                  
                                  {/* HEADER COM VOLTAR (NOVO) */}
                                  <div className="flex items-center mb-4">
                                      <Button variant="ghost" size="icon" onClick={() => setStep(step - 1)} className="rounded-full h-8 w-8 text-stone-400 hover:text-[#C6A87C] hover:bg-stone-50 mr-2"><ArrowLeft className="w-4 h-4"/></Button>
                                      <span className="text-sm font-bold text-stone-500">Voltar</span>
                                  </div>

                                  <div className="text-center bg-[#FAF8F5] p-6 rounded-3xl border border-[#F2EBE0]">
                                      <p className="text-[10px] uppercase font-bold tracking-widest text-[#C6A87C] mb-1">AGENDANDO</p>
                                      <h3 className="text-xl font-bold text-stone-800 mb-1">{formData.type === 'combo' || formData.type === 'package' ? selectedPromo?.title : orderedServices[currentSessionIndex]?.name}</h3>
                                      {/* Se for Pacote, avisa que é a 1ª sessão */}
                                      {formData.type === 'package' && <p className="text-xs text-[#C6A87C] font-bold uppercase mt-2">Agendando 1ª Sessão (Início)</p>}
                                      {formData.type === 'service' && orderedServices.length > 1 && <p className="text-xs text-stone-500">Item {currentSessionIndex + 1} de {orderedServices.length}</p>}
                                  </div>
                                  {step === 3 && (
                                      <div className="space-y-6">
                                          <div className="space-y-4">
                                              {(formData.type === 'combo' ? orderedServices : (formData.type === 'package' ? [orderedServices[0]] : [orderedServices[currentSessionIndex]])).map((service, idx) => (
                                                  <div key={idx}>
                                                      <Label className="text-xs uppercase tracking-wider text-stone-500 font-bold mb-2 block pl-1">
                                                          {formData.type === 'combo' ? service.name : (formData.type === 'package' ? 'Profissional (Início)' : 'Profissional')}
                                                      </Label>
                                                      <Select value={formData.staffMapping[formData.type === 'combo' ? idx : currentSessionIndex] || ''} onValueChange={v => handleStaffSelect(formData.type === 'combo' ? idx : currentSessionIndex, v)}>
                                                          <SelectTrigger className="h-12 rounded-xl bg-white border-stone-200 focus:ring-[#C6A87C]"><SelectValue placeholder="Selecione..."/></SelectTrigger>
                                                          <SelectContent>{getStaffForService(service.id).map((s: Staff) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                                      </Select>
                                                  </div>
                                              ))}
                                          </div>
                                          <div className="flex justify-center bg-white rounded-2xl border border-stone-100 p-2 shadow-sm">
                                              <Calendar 
                                                mode="single" 
                                                selected={formData.currentDate} 
                                                onSelect={d => d && setFormData(f => ({...f, currentDate: d, currentTime: ''}))} 
                                                locale={ptBR} 
                                                disabled={isDateDisabled} 
                                                classNames={{ day_selected: "bg-[#C6A87C] text-white hover:bg-[#C6A87C] hover:text-white focus:bg-[#C6A87C] focus:text-white", day_today: "bg-stone-100 text-stone-900" }} 
                                            />
                                          </div>
                                          
                                          {/* Aviso sobre datas automáticas no Pacote */}
                                          {formData.type === 'package' && (
                                              <div className="text-center text-xs text-stone-400 px-4 bg-stone-50 py-2 rounded-lg">
                                                  <Info className="w-3 h-3 inline mr-1 mb-0.5"/>
                                                  As datas das próximas sessões serão calculadas automaticamente com base no intervalo do pacote.
                                              </div>
                                          )}

                                          <div className="flex justify-between pt-4"><Button variant="ghost" onClick={() => setStep(step - 1)} className="text-stone-400 hover:text-stone-600 text-xs font-bold uppercase tracking-widest">Voltar</Button><Button onClick={() => setStep(4)} disabled={!formData.currentDate} className="bg-[#C6A87C] hover:bg-[#B08D55] text-white rounded-xl px-8 font-bold text-xs uppercase tracking-widest">Ver Horários</Button></div>
                                      </div>
                                  )}
                                  {step === 4 && (
                                      <div>
                                          <h3 className="font-bold text-center text-stone-800 mb-6 text-lg">Horários para {format(formData.currentDate!, 'dd/MM')}</h3>
                                          <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                                              {availableSlots.map((slotObj: any) => (
                                                  <Button 
                                                    key={slotObj.start} 
                                                    variant="outline" 
                                                    onClick={() => setFormData(f => ({...f, currentTime: slotObj.start, currentTimeEnd: slotObj.end}))} 
                                                    className={`h-auto py-3 flex flex-col items-center rounded-xl border transition-all duration-300 ${formData.currentTime === slotObj.start ? 'bg-[#C6A87C] text-white border-[#C6A87C] shadow-md scale-105' : 'bg-white text-stone-600 border-stone-200 hover:border-[#C6A87C] hover:text-[#C6A87C] hover:bg-stone-50'}`}
                                                  >
                                                      <span className="text-sm font-bold">{slotObj.start}</span>
                                                      <span className="text-[10px] font-normal opacity-80">até {slotObj.end}</span>
                                                  </Button>
                                              ))}
                                          </div>
                                          {availableSlots.length === 0 && <p className="text-center text-stone-400 py-12 bg-stone-50 rounded-2xl mt-4 text-xs">Sem horários livres.</p>}
                                          <div className="flex justify-between pt-8"><Button variant="ghost" onClick={() => setStep(3)}>Voltar</Button><Button onClick={handleNextStep} disabled={!formData.currentTime} className="bg-[#C6A87C] hover:bg-[#B08D55] text-white rounded-xl px-8 font-bold text-xs uppercase tracking-widest">Confirmar Sessão</Button></div>
                                      </div>
                                  )}
                              </div>
                          )}
                          {step === 5 && (
                              <div className="space-y-6 font-inter animate-in fade-in slide-in-from-bottom-2">
                                  
                                  {/* HEADER COM VOLTAR (NOVO) */}
                                  <div className="flex items-center mb-6 relative">
                                       <Button variant="ghost" size="icon" onClick={() => setStep(step - 1)} className="absolute left-0 rounded-full h-8 w-8 text-stone-400 hover:text-[#C6A87C] hover:bg-stone-50"><ArrowLeft className="w-4 h-4"/></Button>
                                       <h2 className="text-2xl font-bold text-stone-800 w-full text-center">Finalizar Agendamento</h2>
                                  </div>

                                  <div className="rounded-[1.5rem] overflow-hidden border border-[#C6A87C]/30 shadow-md bg-white">
                                      <div className="bg-[#C6A87C] py-3 text-center"><h2 className="text-white font-bold text-sm tracking-widest uppercase">Resumo do Pedido</h2></div>
                                      <div className="p-6">
                                          {/* SEPARAÇÃO VISUAL: Sessão Atual (Verde/Dourado) vs Futuras (Cinza) */}
                                          {groupedSessions.map((group: any, idx: number) => (
                                              <div key={group.key} className={`mb-4 ${group.isFuture ? 'opacity-80' : 'scale-105 transform origin-top'}`}>
                                                  {idx === 0 && <p className="text-[10px] font-bold uppercase tracking-widest text-[#C6A87C] mb-2 text-center">Sessão Agendada Agora</p>}
                                                  {idx === 1 && <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2 mt-6 text-center border-t border-dashed border-stone-200 pt-4">Próximas Sessões Automáticas</p>}

                                                  <div className={`p-4 rounded-xl border ${group.isFuture ? 'bg-stone-50 border-stone-100' : 'bg-[#FAF8F5] border-[#C6A87C]/40 shadow-sm'}`}>
                                                      <div className="flex flex-col items-center mb-3">
                                                          <div className="flex items-center gap-2 mb-1">
                                                              <CalendarIcon className={`w-4 h-4 ${group.isFuture ? 'text-stone-400' : 'text-[#C6A87C]'}`} />
                                                              <span className={`text-sm font-bold ${group.isFuture ? 'text-stone-600' : 'text-[#5A4D3F]'}`}>{format(group.date, "dd 'de' MMMM", { locale: ptBR })} • {group.time}</span>
                                                          </div>
                                                          <p className="text-[10px] text-stone-400 italic">Previsão de término {group.endTimePrediction}</p>
                                                      </div>
                                                      <div className="space-y-2">
                                                          {group.items.map((item: any, i: number) => (
                                                              <div key={i} className="flex justify-between items-start text-sm">
                                                                  <div><h4 className="font-bold text-[#4A3B2C]">{item.name}</h4><p className="text-[11px] text-stone-400 italic">com {item.staffName || 'A definir'}</p></div>
                                                                  <div className="text-right"><span className="text-[10px] text-stone-400 block">{item.duration} min</span></div>
                                                              </div>
                                                          ))}
                                                      </div>
                                                  </div>
                                              </div>
                                          ))}
                                          
                                          {/* 🔥 PREÇO FINAL: MOSTRA O ORIGINAL RISCADO SE TIVER DESCONTO */}
                                          <div className="mt-8 mx-auto max-w-[600px] bg-[#FAF8F5] rounded-2xl p-3 text-center shadow-sm">
                                              <span className="text-[10px] font-bold text-[#C6A87C] uppercase tracking-widest block mb-2">TOTAL A PAGAR</span>
                                              <div className="flex flex-col items-center justify-center">
                                                  
                                                  {/* Se for Promo ou Tiver Parceria, risca o preço cheio */}
                                                  {originalTotalPrice > totalPrice && (
                                                      <span className="text-sm text-stone-400 line-through mb-1">R$ {formattedOriginalPrice}</span>
                                                  )}
                                                  
                                                  <span className="text-2xl font-bold text-[#4A3B2C]">R$ {formattedPrice}</span>
                                                  
                                                  {/* Se tiver parceiro e for serviço, mostra o badge de confirmação */}
                                                  {activePartner && formData.type === 'service' && (
                                                      <span className="text-[10px] text-[#C6A87C] font-bold mt-1 uppercase tracking-wide">
                                                          Parceria: {activePartner.name}
                                                      </span>
                                                  )}
                                              </div>
                                          </div>
                                      </div>
                                      {/* RODAPÉ DE AVISO */}
                                      <div className="bg-stone-50 p-3 text-center text-[10px] text-stone-400 border-t border-stone-100">
                                          <Phone className="w-3 h-3 inline mr-1 mb-0.5"/> Em caso de reagendamento, favor entrar em contato com a Alessandra.
                                      </div>
                                  </div>

                                  {/* Formuário de Dados (Mantido igual) */}
                                  <div className="rounded-[1.5rem] overflow-hidden border border-[#C6A87C]/30 bg-white">
                                      <div className="bg-[#C6A87C] py-3 text-center"><h2 className="text-white font-bold text-sm tracking-widest uppercase">Dados para Agendamento</h2></div>
                                      <div className="p-6 space-y-5">
                                          <div className="space-y-4"><div className="space-y-1"><Label className="text-[10px] font-bold text-[#8C7B68] uppercase pl-1">WhatsApp</Label><Input className="h-11 bg-stone-50 border-stone-200 focus:border-[#C6A87C] focus:ring-0 rounded-xl text-sm" value={formData.customerPhone} onChange={e => setFormData(f => ({...f, customerPhone: formatPhoneDisplay(e.target.value)}))} onBlur={handlePhoneBlur} placeholder="(11) 99999-9999" /></div><div className="space-y-1"><Label className="text-[10px] font-bold text-[#8C7B68] uppercase pl-1">E-mail</Label><Input className="h-11 bg-stone-50 border-stone-200 focus:border-[#C6A87C] focus:ring-0 rounded-xl text-sm" type="email" value={formData.customerEmail} onChange={e => setFormData(f => ({...f, customerEmail: e.target.value}))} /></div><div className="space-y-1"><Label className="text-[10px] font-bold text-[#8C7B68] uppercase pl-1">Nome Completo</Label><Input className="h-11 bg-stone-50 border-stone-200 focus:border-[#C6A87C] focus:ring-0 rounded-xl text-sm" value={formData.customerName} onChange={e => setFormData(f => ({...f, customerName: e.target.value}))} /></div><div className="space-y-1"><Label className="text-[10px] font-bold text-[#8C7B68] uppercase pl-1">Observações (Opcional)</Label><Textarea className="bg-stone-50 border-stone-200 focus:border-[#C6A87C] focus:ring-0 rounded-xl text-sm resize-none" value={userNotes} onChange={e => setUserNotes(e.target.value)}/></div></div>
                                          
                                          {/* 🔥 SÓ MOSTRA INDICAÇÃO SE NÃO TIVER PARCEIRO ATIVO */}
                                          {!activePartner && (
                                              <div className={`p-4 rounded-xl border transition-all duration-300 ${hasReferral ? 'bg-white border-[#C6A87C] shadow-sm' : 'bg-[#F2EBE0] border-transparent'}`}>
                                                  {isExistingCustomer ? (
                                                      <div className="flex items-center gap-3 text-stone-400">
                                                          <Ban className="w-5 h-5" />
                                                          <span className="text-xs font-bold uppercase tracking-wide">Indicações válidas apenas para novos clientes</span>
                                                      </div>
                                                  ) : (
                                                      <div className="flex items-center justify-between cursor-pointer" onClick={() => setHasReferral(!hasReferral)}>
                                                          <div className="flex items-center gap-3">
                                                              <Gift className={`w-5 h-5 ${hasReferral ? 'text-[#C6A87C]' : 'text-stone-400'}`} />
                                                              <span className="text-xs font-bold text-[#8C7B68] uppercase tracking-wide">Foi Indicação?</span>
                                                          </div>
                                                          <Checkbox checked={hasReferral} onCheckedChange={(c) => setHasReferral(c as boolean)} className="data-[state=checked]:bg-[#C6A87C] data-[state=checked]:border-[#C6A87C] h-5 w-5 rounded-md" />
                                                      </div>
                                                  )}
                                                  
                                                  {hasReferral && !isExistingCustomer && (
                                                      <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 pt-2 border-t border-stone-200">
                                                          <div className="space-y-1">
                                                              <Label className="text-[10px] font-bold text-[#8C7B68] uppercase pl-1">WhatsApp de quem indicou</Label>
                                                              <Input className="h-10 bg-white border-[#C6A87C] focus:border-[#C6A87C] rounded-lg text-sm" placeholder="(00) 00000-0000" value={referrerPhone} onChange={(e) => setReferrerPhone(formatPhoneDisplay(e.target.value))} onBlur={handleReferrerBlur} />
                                                          </div>
                                                          {referrerName && (
                                                              <div className="flex items-center gap-2 text-xs text-[#C6A87C] bg-[#C6A87C]/10 p-2 rounded-lg">
                                                                  <Sparkles className="w-3 h-3" />
                                                                  <span>Confirmado: <strong>{referrerName}</strong></span>
                                                              </div>
                                                          )}
                                                      </div>
                                                  )}
                                              </div>
                                          )}

                                          <div className="flex items-start gap-3 px-2"><Checkbox id="terms" checked={consentGiven} onCheckedChange={(c) => setConsentGiven(c as boolean)} className="mt-0.5 data-[state=checked]:bg-[#C6A87C] data-[state=checked]:border-[#C6A87C]" /><label htmlFor="terms" className="text-xs text-stone-500 leading-snug cursor-pointer">Li e aceito os termos de agendamento.</label></div>
                                      </div>
                                  </div>
                                  <div className="pb-8 pt-2"><Button onClick={handleFinalize} disabled={!formData.customerName || !formData.customerPhone || !formData.customerEmail || !consentGiven || createAppointmentMutation.isPending} className="w-full h-14 bg-[#C6A87C] hover:bg-[#B08D55] text-white font-bold text-sm uppercase tracking-widest rounded-xl shadow-lg transition-all transform active:scale-95">{createAppointmentMutation.isPending ? <Loader2 className="animate-spin mr-2"/> : "FINALIZAR AGENDAMENTO"}</Button><div className="text-center mt-4"><Button variant="ghost" onClick={() => setStep(step - 1)} className="text-stone-400 hover:text-stone-600 text-xs font-bold uppercase tracking-widest">Voltar</Button></div></div>
                              </div>
                          )}
                          {step === 6 && (<div className="py-20 text-center animate-in zoom-in duration-700 font-inter"><div className="w-24 h-24 bg-[#C6A87C]/10 rounded-full flex items-center justify-center mx-auto mb-6"><Check className="w-12 h-12 text-[#C6A87C]"/></div><h2 className="text-3xl font-bold text-stone-800 mb-3">Tudo Certo!</h2><p className="text-stone-500 mb-10 max-w-xs mx-auto text-base leading-relaxed">Seu agendamento foi realizado com sucesso. Enviamos a confirmação para o seu WhatsApp.</p><Button className="w-full h-14 text-sm font-bold uppercase tracking-widest rounded-xl bg-[#C6A87C] hover:bg-[#B08D55] shadow-2xl text-white" onClick={() => window.location.reload()}>Fazer Novo Agendamento</Button></div>)}
                      </div>
                  </Card>
              </div>
          )}
          
          {/* 🔥 RODAPÉ GERENCIA NO FINAL DA PÁGINA (VISÍVEL EM TODAS AS ETAPAS) */}
          <footer className="relative z-30 pb-4 pt-2 text-center text-[10px] text-[#9B9089]/60 font-medium">
              2026 @ <a href="http://gerenc.com" target="_blank" rel="noreferrer" className="hover:text-[#C6A87C] transition-colors underline decoration-dotted">GerencIA</a> - Todos direitos reservado
          </footer>
      </div>
  );
}
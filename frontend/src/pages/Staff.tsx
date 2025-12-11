import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  Calendar as CalendarIcon, 
  DollarSign, 
  Umbrella, 
  Pencil, 
  Trash2, 
  Check, 
  X, 
  MapPin, 
  Paintbrush, 
  Clock, 
  UserCog, 
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Wallet,
  Users,
  CheckCircle2,
  CalendarDays,
  ArrowUpRight
} from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  addDays, 
  addWeeks, 
  subWeeks, 
  subMonths, 
  addMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  startOfDay, 
  endOfDay, 
  isSameMonth, 
  isToday, 
  differenceInDays 
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import {
    staffAPI,
    servicesAPI,
    staffShiftsAPI,
    locationsAPI,
    staffExceptionsAPI,
    staffCommissionsAPI,
    staffServicesAPI
} from "@/services/api";

// --- TIPAGEM ---
interface StaffMember { id: string; name: string; full_name?: string; role: string; active: boolean; work_locations: string[]; services: string[]; default_commission_percentage?: number; }
interface Service { id: string; name: string; price_centavos?: number; }
interface StaffService { staff_id: string; service_id: string; service_name?: string; }
interface StaffShift { id?: number; staff_id: string; location_id: string; weekday: number; start_time: string; end_time: string; }
interface StaffException { id: string; staff_id: string; staff_name?: string; start_date: string; end_date: string; type: 'folga' | 'férias' | 'atestado'; status: 'aprovado' | 'pendente' | 'rejeitado'; notes?: string; }
interface StaffCommission { id: string; staff_id: string; staff_name?: string; service_id: string; service_name?: string; date: string; service_price_centavos: number; commission_percentage: number; commission_amount_centavos: number; status: 'pendente_pagamento' | 'pago' | 'cancelado'; payment_date?: string; notes?: string; }
interface Location { id: string; name: string; }

interface ShiftPayload { 
  id?: number; 
  staff_id: string; 
  location_id: string; 
  weekday: number; 
  start_time: string; 
  end_time: string; 
}

const ALL_LOCATIONS_VALUE = "all-locations-filter";

// --- FUNÇÕES AUXILIARES ---
const getLocationNameById = (locationId: string, locations: Location[]): string => { return locations.find(l => l.id === locationId)?.name || 'Desconhecida'; };
const getSchedulesForStaffAndDay = (staffId: string, dayOfWeek: number, shifts: StaffShift[], selectedLocationId: string): StaffShift[] => { const dbWeekday = dayOfWeek === 0 ? 7 : dayOfWeek; return shifts.filter(s => { const matchesDay = s.staff_id === staffId && s.weekday === dbWeekday; if (!selectedLocationId) return matchesDay; return matchesDay && (s.location_id === selectedLocationId); }); };
const hasTimeOffOnDate = (staffId: string, date: Date, exceptions: StaffException[]): StaffException | undefined => { return exceptions.find(exc => { const excStart = startOfDay(new Date(exc.start_date)).getTime(); const excEnd = endOfDay(new Date(exc.end_date)).getTime(); const dateToCheck = startOfDay(date).getTime(); return exc.staff_id === staffId && exc.status === 'aprovado' && dateToCheck >= excStart && dateToCheck <= excEnd; }); };

const timeOffTypeColors: Record<string, string> = { férias: "bg-blue-500", folga: "bg-amber-500", atestado: "bg-red-500" };
const statusColors: Record<string, string> = { aprovado: "bg-green-500", pendente: "bg-amber-500", rejeitado: "bg-red-500", pago: "bg-emerald-500", pendente_pagamento: "bg-amber-500", cancelado: "bg-stone-400" };

// --- COMPONENTES MODAIS (Simplificados para brevidade, lógica mantida) ---

// 1. Modal Turno
function ShiftEditModal({ shiftData, allStaff, allLocations, onClose, onSave, onDelete, isSaving, isDeleting }: any) { 
  const isEditing = !!shiftData?.id; 
  const [startTime, setStartTime] = useState(shiftData?.start_time.substring(0, 5) || '09:00'); 
  const [endTime, setEndTime] = useState(shiftData?.end_time.substring(0, 5) || '18:00'); 
  const [selectedLocationId, setSelectedLocationId] = useState(shiftData?.location_id || allLocations[0]?.id || ''); 
  const [selectedStaffId, setSelectedStaffId] = useState(shiftData?.staff_id || '');

  useEffect(() => { 
    setStartTime(shiftData?.start_time.substring(0, 5) || '09:00'); 
    setEndTime(shiftData?.end_time.substring(0, 5) || '18:00'); 
    setSelectedLocationId(shiftData?.location_id || allLocations[0]?.id || ''); 
    setSelectedStaffId(shiftData?.staff_id || (allStaff.length > 0 ? allStaff[0].id : ''));
  }, [shiftData, allLocations, allStaff]); 
  
  if (!shiftData) return null; 
  const dayName = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][shiftData.weekday % 7]; 

  return (
    <Dialog open={!!shiftData} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] bg-white dark:bg-stone-950 border-stone-100 dark:border-stone-800">
        <DialogHeader><DialogTitle className="text-stone-800 dark:text-stone-100">{isEditing ? 'Editar Turno' : 'Novo Turno'}</DialogTitle><div className="text-sm text-stone-500 capitalize">{dayName}</div></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2"><Label>Profissional</Label><Select value={selectedStaffId} onValueChange={setSelectedStaffId} disabled={isSaving || isDeleting || isEditing}><SelectTrigger className="bg-stone-50 dark:bg-stone-900"><SelectValue /></SelectTrigger><SelectContent>{allStaff.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Unidade</Label><Select value={selectedLocationId} onValueChange={setSelectedLocationId} disabled={isSaving || isDeleting}><SelectTrigger className="bg-stone-50 dark:bg-stone-900"><SelectValue /></SelectTrigger><SelectContent>{allLocations.map((loc: any) => (<SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>))}</SelectContent></Select></div>
          <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Início</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="bg-stone-50 dark:bg-stone-900" /></div><div className="space-y-2"><Label>Fim</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="bg-stone-50 dark:bg-stone-900" /></div></div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">{isEditing && (<Button variant="ghost" onClick={() => { if(confirm("Excluir?")) onDelete(shiftData.id) }} className="text-red-500 mr-auto"><Trash2 className="w-4 h-4"/></Button>)}<Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => onSave({ ...shiftData, staff_id: selectedStaffId, start_time: `${startTime}:00`, end_time: `${endTime}:00`, location_id: selectedLocationId })} className="bg-[#C6A87C] hover:bg-[#B08D55] text-white">Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  ); 
}

// 2. Modal Profissional
function StaffDetailModal({ member, allServices, staffServices, onClose, onSave, isSaving }: any) { 
  const [name, setName] = useState(''); const [role, setRole] = useState(''); const [active, setActive] = useState(true); const [commission, setCommission] = useState(0); const [selectedServices, setSelectedServices] = useState<string[]>([]); 
  useEffect(() => { if (member) { setName(member.name); setRole(member.role || ''); setActive(member.active ?? true); setCommission(member.default_commission_percentage ?? 0); setSelectedServices(staffServices.filter((ss: any) => ss.staff_id === member.id).map((ss: any) => ss.service_id)); } }, [member, staffServices]); 
  const handleSave = () => { if (!member) return; const originalIds = staffServices.filter((ss: any) => ss.staff_id === member.id).map((ss: any) => ss.service_id); onSave({ staffData: { id: member.id, name, role, active, default_commission_percentage: commission }, servicesToAdd: selectedServices.filter(id => !originalIds.includes(id)), servicesToRemove: originalIds.filter((id: any) => !selectedServices.includes(id)) }); }; 
  if (!member) return null; 
  return (
    <Dialog open={!!member} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-white dark:bg-stone-950 border-stone-100 dark:border-stone-800">
        <DialogHeader><DialogTitle className="text-stone-800 dark:text-stone-100">{member.id ? 'Editar' : 'Novo'} Profissional</DialogTitle></DialogHeader>
        <div className="grid gap-6 py-4"><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="bg-stone-50 dark:bg-stone-900" /></div><div className="space-y-2"><Label>Cargo</Label><Input value={role} onChange={(e) => setRole(e.target.value)} className="bg-stone-50 dark:bg-stone-900" /></div></div><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Status</Label><Select value={active ? 'active' : 'inactive'} onValueChange={(v) => setActive(v === 'active')}><SelectTrigger className="bg-stone-50 dark:bg-stone-900"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Ativo</SelectItem><SelectItem value="inactive">Inativo</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Comissão (%)</Label><Input type="number" value={commission} onChange={(e) => setCommission(parseFloat(e.target.value))} className="bg-stone-50 dark:bg-stone-900" /></div></div><div className="space-y-2"><Label>Serviços</Label><div className="flex flex-wrap gap-2 p-2 border rounded-lg bg-stone-50/50 max-h-32 overflow-y-auto">{allServices.map((s:any) => (<Button key={s.id} size="sm" variant={selectedServices.includes(s.id) ? "default" : "outline"} onClick={() => setSelectedServices(p => p.includes(s.id) ? p.filter(id => id !== s.id) : [...p, s.id])} className={`text-xs h-7 ${selectedServices.includes(s.id) ? "bg-[#C6A87C]" : ""}`}>{s.name}</Button>))}</div></div></div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={handleSave} className="bg-[#C6A87C] hover:bg-[#B08D55] text-white">Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  ); 
}

// 3. Modal Folga
function TimeOffModal({ staff }: { staff: StaffMember[] }) { 
  const [open, setOpen] = useState(false); const [formData, setFormData] = useState({ staff_id: "", start_date: format(new Date(), "yyyy-MM-dd"), end_date: format(new Date(), "yyyy-MM-dd"), type: "folga", notes: "" }); const queryClient = useQueryClient(); const mutation = useMutation({ mutationFn: (data: any) => staffExceptionsAPI.create(data), onSuccess: () => { toast.success("Registrado!"); setOpen(false); queryClient.invalidateQueries({ queryKey: ['staffExceptions'] }); } }); 
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="border-stone-200 text-stone-600 hover:text-[#C6A87C]"><Plus className="w-4 h-4 mr-2" />Nova Folga</Button></DialogTrigger>
      <DialogContent className="bg-white dark:bg-stone-950 border-stone-100 dark:border-stone-800"><DialogHeader><DialogTitle>Registrar Ausência</DialogTitle></DialogHeader><div className="grid gap-4 py-4"><div><Label>Profissional</Label><Select onValueChange={(v) => setFormData({...formData, staff_id: v})}><SelectTrigger className="bg-stone-50 dark:bg-stone-900"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Tipo</Label><Select onValueChange={(v:any) => setFormData({...formData, type: v})} defaultValue="folga"><SelectTrigger className="bg-stone-50 dark:bg-stone-900"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="folga">Folga</SelectItem><SelectItem value="férias">Férias</SelectItem><SelectItem value="atestado">Atestado</SelectItem></SelectContent></Select></div><div className="grid grid-cols-2 gap-4"><div><Label>Início</Label><Input type="date" value={formData.start_date} onChange={(e) => setFormData({...formData, start_date: e.target.value})} className="bg-stone-50 dark:bg-stone-900" /></div><div><Label>Fim</Label><Input type="date" value={formData.end_date} onChange={(e) => setFormData({...formData, end_date: e.target.value})} className="bg-stone-50 dark:bg-stone-900" /></div></div><div className="space-y-2"><Label>Obs</Label><Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} className="bg-stone-50 dark:bg-stone-900" /></div></div><DialogFooter><Button onClick={() => mutation.mutate(formData)} className="bg-[#C6A87C] hover:bg-[#B08D55] text-white">Salvar</Button></DialogFooter></DialogContent>
    </Dialog>
  ); 
}

// 4. Modal Comissão
function ManualCommissionModal({ staff, services }: { staff: StaffMember[]; services: Service[] }) { 
  const [open, setOpen] = useState(false); const [formData, setFormData] = useState({ staff_id: "", service_id: "", date: format(new Date(), "yyyy-MM-dd"), service_price_centavos: 0, commission_percentage: 0 }); const queryClient = useQueryClient(); const mutation = useMutation({ mutationFn: (data: any) => staffCommissionsAPI.create({ ...data, commission_amount_centavos: (data.service_price_centavos * data.commission_percentage) / 100, status: "pendente_pagamento" }), onSuccess: () => { toast.success("Lançado!"); setOpen(false); queryClient.invalidateQueries({ queryKey: ['staffCommissions'] }); } }); 
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="border-stone-200 text-stone-600 hover:text-[#C6A87C]"><Plus className="w-4 h-4 mr-2" />Lançamento Manual</Button></DialogTrigger>
      <DialogContent className="bg-white dark:bg-stone-950 border-stone-100 dark:border-stone-800"><DialogHeader><DialogTitle>Lançamento Avulso</DialogTitle></DialogHeader><div className="grid gap-4 py-4"><div className="grid grid-cols-2 gap-4"><div><Label>Profissional</Label><Select onValueChange={(v) => setFormData({...formData, staff_id: v})}><SelectTrigger className="bg-stone-50 dark:bg-stone-900"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Serviço</Label><Select onValueChange={(v) => setFormData({...formData, service_id: v})}><SelectTrigger className="bg-stone-50 dark:bg-stone-900"><SelectValue placeholder="Opcional" /></SelectTrigger><SelectContent>{services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div></div><div className="grid grid-cols-2 gap-4"><div><Label>Valor Base</Label><Input type="number" onChange={(e) => setFormData({...formData, service_price_centavos: parseFloat(e.target.value) * 100})} className="bg-stone-50 dark:bg-stone-900" /></div><div><Label>Comissão %</Label><Input type="number" onChange={(e) => setFormData({...formData, commission_percentage: parseFloat(e.target.value)})} className="bg-stone-50 dark:bg-stone-900" /></div></div><div className="space-y-2"><Label>Data</Label><Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="bg-stone-50 dark:bg-stone-900" /></div></div><DialogFooter><Button onClick={() => mutation.mutate(formData)} className="bg-[#C6A87C] hover:bg-[#B08D55] text-white">Lançar</Button></DialogFooter></DialogContent>
    </Dialog>
  ); 
}

// --- PÁGINA PRINCIPAL ---
export default function Staff() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // Estados
  const [activeTab, setActiveTab] = useState('team'); // Opções: 'team', 'schedule', 'timeoff', 'commissions'
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [scheduleView, setScheduleView] = useState<"week" | "month">("week");
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  
  // Filtros
  const [exceptionStatusFilter, setExceptionStatusFilter] = useState<string>("pendente");
  const [commissionMonthFilter, setCommissionMonthFilter] = useState(format(new Date(), 'yyyy-MM'));
  const [commissionStatusFilter, setCommissionStatusFilter] = useState("all");

  const [editingShiftData, setEditingShiftData] = useState<ShiftPayload | null>(null);
  const [editingStaffMember, setEditingStaffMember] = useState<StaffMember | null>(null);

  // Queries
  const { data: rawStaff = [], isLoading: isLoadingStaff } = useQuery<any[]>({ queryKey: ['staff'], queryFn: staffAPI.getAll });
  const { data: services = [], isLoading: isLoadingServices } = useQuery<Service[]>({ queryKey: ['services'], queryFn: servicesAPI.getAll });
  const { data: staffServices = [] } = useQuery<StaffService[]>({ queryKey: ['staffServices'], queryFn: staffServicesAPI.getAll });
  const { data: staffShifts = [] } = useQuery<StaffShift[]>({ queryKey: ['staffShifts'], queryFn: staffShiftsAPI.getAll });
  const { data: exceptions = [] } = useQuery<StaffException[]>({ queryKey: ['staffExceptions'], queryFn: staffExceptionsAPI.getAll });
  const { data: commissions = [] } = useQuery<StaffCommission[]>({ queryKey: ['staffCommissions'], queryFn: staffCommissionsAPI.getAll });
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ['locations'], queryFn: locationsAPI.getAll });

  // Processamento
  const weekStart = startOfWeek(currentWeek, { locale: ptBR });
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { locale: ptBR });
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });
  const monthDays = useMemo(() => eachDayOfInterval({ start: calendarStart, end: calendarEnd }), [calendarStart, calendarEnd]);

  const staffWithDetails = useMemo<StaffMember[]>(() => { 
    const serviceMap = services.reduce((acc, s) => ({ ...acc, [s.id]: s.name }), {} as Record<string, string>); 
    const servicesByStaff = staffServices.reduce((acc, ss) => { 
      const staffId = ss.staff_id || (ss as any).staff; 
      const serviceId = ss.service_id || (ss as any).service; 
      if (!acc[staffId]) acc[staffId] = []; if (serviceMap[serviceId]) acc[staffId].push(serviceMap[serviceId]); return acc; 
    }, {} as Record<string, string[]>); 
    
    return rawStaff.map(member => { 
      const memberShifts = staffShifts.filter(s => s.staff_id === member.id); 
      const locationIds = memberShifts.reduce((acc: string[], shift) => { if (!acc.includes(shift.location_id)) { acc.push(shift.location_id); } return acc; }, []); 
      const work_locations = locationIds.map(id => locations.find(l => l.id === id)?.name).filter((name): name is string => !!name); 
      return { ...member, services: servicesByStaff[member.id] || [], name: member.full_name || member.name, active: member.active ?? true, role: member.role || 'Profissional', work_locations: work_locations.length > 0 ? work_locations : ['Sem Turno Definido'], }; 
    }); 
  }, [rawStaff, staffServices, services, staffShifts, locations]);

  const activeStaff = useMemo(() => staffWithDetails.filter(s => s.active), [staffWithDetails]);

  const filteredStaff = useMemo(() => {
    if (!selectedLocation) return staffWithDetails;
    const locationName = locations.find(l => l.id === selectedLocation)?.name;
    return staffWithDetails.filter(s => s.work_locations.includes(locationName || ''));
  }, [staffWithDetails, selectedLocation, locations]);

  const filteredExceptions = useMemo(() => exceptions.filter(exc => { 
    const matchStatus = exceptionStatusFilter === 'all' || exc.status === exceptionStatusFilter; 
    const staffMember = filteredStaff.find(s => s.id === exc.staff_id); 
    return matchStatus && !!staffMember; 
  }), [exceptions, exceptionStatusFilter, filteredStaff]);

  const filteredCommissions = useMemo(() => commissions.filter(c => { 
    const matchStatus = commissionStatusFilter === 'all' || c.status === commissionStatusFilter; 
    const commissionDate = new Date(`${c.date}T12:00:00`); 
    const matchMonth = format(commissionDate, 'yyyy-MM') === commissionMonthFilter; 
    const staffMember = filteredStaff.find(s => s.id === c.staff_id); 
    return matchStatus && matchMonth && !!staffMember; 
  }), [commissions, commissionStatusFilter, commissionMonthFilter, filteredStaff]);
  
  const commissionsByStaff = useMemo(() => filteredCommissions.reduce((acc, commission) => { const staffId = commission.staff_id; if (!acc[staffId]) { acc[staffId] = []; } acc[staffId].push(commission); return acc; }, {} as Record<string, StaffCommission[]>), [filteredCommissions]);
  
  const totalCommissionAmount = filteredCommissions.reduce((sum, c) => sum + c.commission_amount_centavos, 0) / 100;
  const paidCommissionAmount = filteredCommissions.filter(c => c.status === 'pago').reduce((sum, c) => sum + c.commission_amount_centavos, 0) / 100;
  const pendingCommissionAmount = totalCommissionAmount - paidCommissionAmount;

  // Mutations
  const saveShift = useMutation({ mutationFn: (payload: ShiftPayload) => payload.id ? staffShiftsAPI.update(payload.id, payload) : staffShiftsAPI.create(payload), onSuccess: () => { toast.success("Turno salvo!"); setEditingShiftData(null); queryClient.invalidateQueries({ queryKey: ['staffShifts'] }); } });
  const deleteShift = useMutation({ mutationFn: (id: number) => staffShiftsAPI.delete(id), onSuccess: () => { toast.success("Turno removido."); setEditingShiftData(null); queryClient.invalidateQueries({ queryKey: ['staffShifts'] }); } });
  const saveStaffDetails = useMutation({ mutationFn: async ({ staffData, servicesToAdd, servicesToRemove }: any) => { const isNew = !editingStaffMember?.id; let staffId = editingStaffMember?.id; if (isNew) { const { id, ...createData } = staffData; const newStaff = await staffAPI.create(createData); staffId = newStaff.id; } else { if(staffId) await staffAPI.update(staffId as string, staffData); } if (staffId) { await Promise.all([...servicesToAdd.map((sid: string) => staffServicesAPI.create({ staff: staffId, service: sid })), ...servicesToRemove.map((sid: string) => staffServicesAPI.delete(`delete-by-params/?staff_id=${staffId}&service_id=${sid}`))]); } return staffId; }, onSuccess: () => { toast.success("Salvo com sucesso!"); setEditingStaffMember(null); queryClient.invalidateQueries({ queryKey: ['staff'] }); queryClient.invalidateQueries({ queryKey: ['staffServices'] }); } });
  const deleteException = useMutation({ mutationFn: (id: string) => staffExceptionsAPI.delete(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staffExceptions'] }); toast.success("Removido!"); } });
  const updateExceptionStatus = useMutation({ mutationFn: ({ id, status }: any) => staffExceptionsAPI.update(id, { status }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staffExceptions'] }); toast.success("Atualizado!"); } });
  const deleteCommission = useMutation({ mutationFn: (id: string) => staffCommissionsAPI.delete(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staffCommissions'] }); toast.success("Excluído!"); } });
  const updateCommissionStatus = useMutation({ mutationFn: ({ id, status, payment_date }: any) => staffCommissionsAPI.update(id, { status, payment_date }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staffCommissions'] }); toast.success("Atualizado!"); } });

  const getStaffName = useCallback((id: string | undefined) => rawStaff.find(s => s.id === id)?.name || `ID: ${id}`, [rawStaff]);
  const handleCommissionMonthChange = (direction: 'next' | 'prev') => { const currentDate = new Date(commissionMonthFilter + '-02T12:00:00'); const newDate = direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1); setCommissionMonthFilter(format(newDate, 'yyyy-MM')); };
  const getStaffStatusForToday = (member: StaffMember) => { const today = new Date(); const timeOff = hasTimeOffOnDate(member.id, today, exceptions); if (timeOff) return <span className="font-medium text-amber-600">Ausente: {timeOff.type}</span>; const todayShifts = getSchedulesForStaffAndDay(member.id, today.getDay(), staffShifts, selectedLocation); if (todayShifts.length > 0) { const shift = todayShifts[0]; return <span className="text-emerald-600 font-medium">Trabalhando: {shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)}</span>; } return <span className="text-stone-400">Folga</span>; };

  if (isLoadingStaff) return <div className="p-20 text-center text-stone-400">Carregando equipe...</div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 bg-stone-50/50 dark:bg-stone-950 min-h-screen font-sans">
      
      {/* Modais Globais */}
      <ShiftEditModal shiftData={editingShiftData} staffName={editingShiftData ? getStaffName(editingShiftData.staff_id) : ''} allStaff={rawStaff} allLocations={locations} onClose={() => setEditingShiftData(null)} onSave={saveShift.mutate} onDelete={deleteShift.mutate} isSaving={saveShift.isPending} />
      <StaffDetailModal member={editingStaffMember} allServices={services} staffServices={staffServices} onClose={() => setEditingStaffMember(null)} onSave={saveStaffDetails.mutate} isSaving={saveStaffDetails.isPending} />

      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-stone-900 rounded-lg shadow-sm border border-stone-100 dark:border-stone-800">
               <UserCog className="w-5 h-5 text-[#C6A87C]" />
            </div>
            Profissionais
          </h1>
          <p className="text-stone-500 dark:text-stone-400 text-sm mt-1 ml-1">
            Gestão de equipe e finanças.
          </p>
        </div>
        <Button onClick={() => setEditingStaffMember({ id: '', name: '', role: 'Profissional', active: true, default_commission_percentage: 0, work_locations: [], services: [] })} className="bg-[#C6A87C] hover:bg-[#B08D55] text-white shadow-md">
          <Plus className="w-4 h-4 mr-2" /> Novo Profissional
        </Button>
      </div>

      {/* --- MENU DE NAVEGAÇÃO "CLEAN" --- */}
      <nav className="flex overflow-x-auto pb-2 gap-2 border-b border-stone-200 dark:border-stone-800">
         <Button variant={activeTab === 'team' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('team')} className={`rounded-full px-5 text-sm ${activeTab === 'team' ? 'bg-[#C6A87C]/10 text-[#C6A87C] hover:bg-[#C6A87C]/20' : 'text-stone-500 hover:text-stone-700'}`}>
            <Users className="w-4 h-4 mr-2" /> Equipe
         </Button>
         <Button variant={activeTab === 'schedule' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('schedule')} className={`rounded-full px-5 text-sm ${activeTab === 'schedule' ? 'bg-[#C6A87C]/10 text-[#C6A87C] hover:bg-[#C6A87C]/20' : 'text-stone-500 hover:text-stone-700'}`}>
            <CalendarIcon className="w-4 h-4 mr-2" /> Escala
         </Button>
         <Button variant={activeTab === 'timeoff' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('timeoff')} className={`rounded-full px-5 text-sm ${activeTab === 'timeoff' ? 'bg-[#C6A87C]/10 text-[#C6A87C] hover:bg-[#C6A87C]/20' : 'text-stone-500 hover:text-stone-700'}`}>
            <Umbrella className="w-4 h-4 mr-2" /> Ausências
         </Button>
         <Button variant={activeTab === 'commissions' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('commissions')} className={`rounded-full px-5 text-sm ${activeTab === 'commissions' ? 'bg-[#C6A87C]/10 text-[#C6A87C] hover:bg-[#C6A87C]/20' : 'text-stone-500 hover:text-stone-700'}`}>
            <Wallet className="w-4 h-4 mr-2" /> Financeiro
         </Button>
      </nav>

      {/* --- CONTEÚDO DAS SEÇÕES --- */}
      
      {/* 1. EQUIPE */}
      {activeTab === 'team' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2">
            <Select value={selectedLocation || ALL_LOCATIONS_VALUE} onValueChange={(v) => setSelectedLocation(v === ALL_LOCATIONS_VALUE ? "" : v)}>
              <SelectTrigger className="w-full md:w-64 bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 rounded-xl">
                 <MapPin className="w-4 h-4 mr-2 text-stone-400" />
                 <SelectValue placeholder="Filtrar por unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_LOCATIONS_VALUE}>Todas as unidades</SelectItem>
                {locations.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStaff.map(s => (
              <Card key={s.id} className="group border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-md transition-all bg-white dark:bg-stone-900">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center font-bold text-stone-500 border border-stone-200 dark:border-stone-700">
                          {s.name.charAt(0).toUpperCase()}
                       </div>
                       <div>
                          <CardTitle className="text-base text-stone-800 dark:text-stone-100">{s.name}</CardTitle>
                          <p className="text-xs text-stone-400">{s.role}</p>
                       </div>
                    </div>
                    <Badge variant={s.active ? "default" : "destructive"} className={s.active ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" : ""}>
                       {s.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="bg-stone-50 dark:bg-stone-950 p-3 rounded-lg space-y-2 border border-stone-100 dark:border-stone-800">
                     <div className="flex items-center gap-2 text-stone-500">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate text-xs">{s.work_locations.join(', ')}</span>
                     </div>
                     <div className="flex items-center gap-2 text-stone-500">
                        <Paintbrush className="w-3 h-3" />
                        <span className="text-xs">{s.services.length} serviços hab.</span>
                     </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-stone-100 dark:border-stone-800 text-xs">
                     <Clock className="w-3 h-3 text-[#C6A87C]" />
                     {getStaffStatusForToday(s)}
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-2 border-stone-200 text-stone-600 hover:text-[#C6A87C] hover:border-[#C6A87C]" onClick={() => setEditingStaffMember(s)}>
                     <Pencil className="w-3 h-3 mr-2" /> Editar Detalhes
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 2. ESCALA */}
      {activeTab === 'schedule' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex flex-col md:flex-row justify-between gap-4 items-center bg-white dark:bg-stone-900 p-3 rounded-xl border border-stone-100 dark:border-stone-800 shadow-sm">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentWeek(scheduleView === "week" ? subWeeks(currentWeek, 1) : subMonths(currentMonth, 1))} className="h-8 w-8"><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm font-medium text-stone-700 dark:text-stone-200 min-w-[150px] text-center capitalize">
                {scheduleView === "week" ? `${format(startOfWeek(currentWeek, { locale: ptBR }), "dd MMM")} - ${format(addDays(startOfWeek(currentWeek, { locale: ptBR }), 6), "dd MMM", { locale: ptBR })}` : format(currentMonth, "MMMM yyyy", { locale: ptBR })}
              </span>
              <Button variant="outline" size="icon" onClick={() => setCurrentWeek(scheduleView === "week" ? addWeeks(currentWeek, 1) : addMonths(currentMonth, 1))} className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <div className="flex gap-2">
              <Select value={scheduleView} onValueChange={(v: any) => setScheduleView(v)}>
                <SelectTrigger className="w-32 bg-stone-50 dark:bg-stone-950 border-stone-200"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="week">Semanal</SelectItem><SelectItem value="month">Mensal</SelectItem></SelectContent>
              </Select>
              <Select value={selectedLocation || ALL_LOCATIONS_VALUE} onValueChange={(v) => setSelectedLocation(v === ALL_LOCATIONS_VALUE ? "" : v)}>
                <SelectTrigger className="w-48 bg-stone-50 dark:bg-stone-950 border-stone-200"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_LOCATIONS_VALUE}>Todas</SelectItem>
                  {locations.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="border-stone-100 dark:border-stone-800 shadow-sm overflow-hidden bg-white dark:bg-stone-900">
            {scheduleView === "week" && (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-stone-50 dark:bg-stone-950 hover:bg-stone-50">
                        <TableHead className="w-[180px] font-bold text-stone-700">Profissional</TableHead>
                        {weekDays.map((day, idx) => (
                          <TableHead key={idx} className="text-center min-w-[100px]">
                            <div className="text-stone-700 font-bold capitalize">{format(day, "EEE", { locale: ptBR })}</div>
                            <div className="text-[10px] text-stone-400 font-normal">{format(day, "dd/MM")}</div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStaff.map(member => (
                        <TableRow key={member.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/50">
                          <TableCell className="font-medium">
                            <div className="text-sm text-stone-800 dark:text-stone-200">{member.name}</div>
                            <div className="text-[10px] text-stone-400">{member.role}</div>
                          </TableCell>
                          {weekDays.map((day, idx) => {
                            const shifts = getSchedulesForStaffAndDay(member.id, day.getDay(), staffShifts, selectedLocation);
                            const off = hasTimeOffOnDate(member.id, day, exceptions);
                            return (
                              <TableCell key={idx} className="p-2 text-center align-top">
                                {off ? (
                                  <Badge variant="secondary" className={`${timeOffTypeColors[off.type]} text-white text-[10px] w-full justify-center py-1`}>{off.type}</Badge>
                                ) : (
                                  <div className="space-y-1">
                                    {shifts.map((shift, i) => (
                                      <div key={i} onClick={() => { if(member.active) setEditingShiftData({...shift, staff_id: member.id, weekday: day.getDay() === 0 ? 7 : day.getDay()}) }} 
                                           className="bg-[#C6A87C]/10 text-[#C6A87C] border border-[#C6A87C]/20 px-1 py-1 rounded text-[10px] cursor-pointer hover:bg-[#C6A87C]/20 transition-colors">
                                        {shift.start_time.slice(0,5)}-{shift.end_time.slice(0,5)}
                                      </div>
                                    ))}
                                    {member.active && (
                                      <Button variant="ghost" size="icon" className="h-5 w-full text-stone-300 hover:text-[#C6A87C] hover:bg-stone-50" 
                                        onClick={() => setEditingShiftData({ staff_id: member.id, location_id: locations[0]?.id, weekday: day.getDay() === 0 ? 7 : day.getDay(), start_time: '09:00:00', end_time: '18:00:00' })}>
                                        <Plus className="w-3 h-3" />
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="md:hidden space-y-4 p-4 bg-stone-50/50">
                  {weekDays.map((day, idx) => (
                    <Card key={idx} className="border-stone-100 shadow-sm">
                      <CardHeader className="py-3 bg-stone-50 border-b border-stone-100">
                        <CardTitle className="text-sm text-stone-700 flex justify-between items-center">
                          <span className="capitalize">{format(day, "EEEE", { locale: ptBR })}</span>
                          <span className="text-xs font-normal text-stone-400">{format(day, "dd/MM")}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        {filteredStaff.map(member => {
                          const shifts = getSchedulesForStaffAndDay(member.id, day.getDay(), staffShifts, selectedLocation);
                          const off = hasTimeOffOnDate(member.id, day, exceptions);
                          if (!shifts.length && !off) return null; 
                          return (
                            <div key={member.id} className="flex justify-between items-center p-3 border-b border-stone-50 last:border-0 text-sm">
                              <span className="font-medium text-stone-700 w-1/3">{member.name}</span>
                              <div className="flex-1 text-right">
                                {off ? (
                                  <Badge className={`${timeOffTypeColors[off.type]} text-white text-[10px]`}>{off.type}</Badge>
                                ) : (
                                  <div className="flex flex-col gap-1 items-end">
                                    {shifts.map((shift, i) => (
                                      <div key={i} onClick={() => setEditingShiftData({...shift, staff_id: member.id, weekday: day.getDay() === 0 ? 7 : day.getDay()})} 
                                           className="bg-[#C6A87C]/10 text-[#C6A87C] px-2 py-1 rounded text-xs cursor-pointer border border-[#C6A87C]/20">
                                        {shift.start_time.slice(0,5)} - {shift.end_time.slice(0,5)}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        <div className="p-2 text-center border-t border-stone-50">
                           <Button variant="ghost" size="sm" className="text-xs text-stone-400 hover:text-[#C6A87C]" onClick={() => setEditingShiftData({ staff_id: activeStaff.length > 0 ? activeStaff[0].id : '', location_id: locations[0]?.id, weekday: day.getDay() === 0 ? 7 : day.getDay(), start_time: '09:00:00', end_time: '18:00:00' })}>+ Adicionar Turno</Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
            {scheduleView === "month" && (
                <div className="p-4">
                  <div className="grid grid-cols-7 gap-1">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (<div key={day} className="text-center text-xs font-semibold text-stone-500 uppercase p-2">{day}</div>))}
                    {monthDays.map((day, idx) => {
                      const isCurrentMonth = isSameMonth(day, currentMonth);
                      const isTodayDate = isToday(day);
                      const staffWorking = filteredStaff.filter(member => {
                        const shifts = getSchedulesForStaffAndDay(member.id, day.getDay(), staffShifts, selectedLocation);
                        const off = hasTimeOffOnDate(member.id, day, exceptions);
                        return shifts.length > 0 && !off;
                      });
                      return (
                        <div key={idx} className={`border rounded p-1 min-h-[80px] flex flex-col ${isCurrentMonth ? 'bg-white' : 'bg-stone-50/50'}`}>
                          <div className="flex justify-end mb-1"><span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium ${isTodayDate ? 'bg-[#C6A87C] text-white' : 'text-stone-500'}`}>{format(day, "d")}</span></div>
                          <div className="space-y-1 overflow-y-auto max-h-[60px]">
                            {staffWorking.slice(0, 3).map(s => (<div key={s.id} className="text-[10px] bg-stone-100 text-stone-600 px-1 rounded truncate">{s.name.split(' ')[0]}</div>))}
                            {staffWorking.length > 3 && (<div className="text-[9px] text-stone-400 pl-1">+{staffWorking.length - 3}</div>)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
            )}
          </Card>
        </div>
      )}

      {/* 3. FOLGAS */}
      {activeTab === 'timeoff' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex justify-between items-center bg-white dark:bg-stone-900 p-3 rounded-xl border border-stone-100 dark:border-stone-800 shadow-sm">
            <Select value={exceptionStatusFilter} onValueChange={setExceptionStatusFilter}>
              <SelectTrigger className="w-40 bg-stone-50 dark:bg-stone-950 border-stone-200"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="pendente">Pendentes</SelectItem><SelectItem value="aprovado">Aprovados</SelectItem></SelectContent>
            </Select>
            <TimeOffModal staff={activeStaff} />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredExceptions.map(exc => (
              <Card key={exc.id} className="border-stone-100 dark:border-stone-800 shadow-sm bg-white dark:bg-stone-900">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-stone-800 dark:text-stone-100">{getStaffName(exc.staff_id)}</h4>
                      <Badge className={`${timeOffTypeColors[exc.type]} text-white text-[10px] mt-1`}>{exc.type.toUpperCase()}</Badge>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${exc.status === 'aprovado' ? 'border-green-500 text-green-600' : 'border-amber-500 text-amber-600'}`}>{exc.status}</Badge>
                  </div>
                  <div className="text-xs text-stone-500 bg-stone-50 dark:bg-stone-950 p-2 rounded mb-3">{format(new Date(exc.start_date + 'T12:00:00'), 'dd/MM')} até {format(new Date(exc.end_date + 'T12:00:00'), 'dd/MM')}<div className="mt-1 italic opacity-70">"{exc.notes || 'Sem observações'}"</div></div>
                  <div className="flex justify-end gap-2">
                    {exc.status === 'pendente' && (<><Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateExceptionStatus.mutate({ id: exc.id, status: 'aprovado' })}>Aprovar</Button><Button size="sm" variant="outline" className="h-7 text-xs text-red-500 border-red-100" onClick={() => updateExceptionStatus.mutate({ id: exc.id, status: 'rejeitado' })}>Recusar</Button></>)}
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-stone-400 hover:text-red-500" onClick={() => deleteException.mutate(exc.id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredExceptions.length === 0 && <p className="col-span-full text-center py-10 text-stone-400">Nenhuma folga encontrada.</p>}
          </div>
        </div>
      )}

      {/* 4. FINANCEIRO (COMISSÕES) */}
      {activeTab === 'commissions' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          
          {/* Header Financeiro */}
          <div className="flex flex-col md:flex-row justify-between gap-4 items-center bg-white dark:bg-stone-900 p-4 rounded-xl border border-stone-100 dark:border-stone-800 shadow-sm">
             <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => handleCommissionMonthChange('prev')} className="h-8 w-8"><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-sm font-bold text-stone-700 dark:text-stone-200 w-32 text-center capitalize">
                   {format(new Date(commissionMonthFilter + '-02T12:00:00'), 'MMMM yyyy', { locale: ptBR })}
                </span>
                <Button variant="outline" size="icon" onClick={() => handleCommissionMonthChange('next')} className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button>
             </div>
             
             <div className="flex gap-2 w-full md:w-auto">
                <Select value={selectedLocation || ALL_LOCATIONS_VALUE} onValueChange={(v) => setSelectedLocation(v === ALL_LOCATIONS_VALUE ? "" : v)}>
                  <SelectTrigger className="w-full md:w-40 bg-stone-50 border-stone-200"><SelectValue placeholder="Unidade" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_LOCATIONS_VALUE}>Todas</SelectItem>
                    {locations.map(loc => <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <ManualCommissionModal staff={activeStaff} services={services} />
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-white dark:bg-stone-900 border-stone-100 dark:border-stone-800 shadow-sm p-4 flex flex-col justify-center">
               <span className="text-xs text-stone-400 uppercase font-semibold mb-1">Total Comissões</span>
               <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-[#C6A87C]/10 rounded-full text-[#C6A87C]"><Wallet className="w-4 h-4" /></div>
                  <span className="text-2xl font-bold text-stone-800 dark:text-stone-100">R$ {totalCommissionAmount.toFixed(2)}</span>
               </div>
            </Card>
            <Card className="bg-white dark:bg-stone-900 border-stone-100 dark:border-stone-800 shadow-sm p-4 flex flex-col justify-center">
               <span className="text-xs text-stone-400 uppercase font-semibold mb-1">Já Pago</span>
               <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-500/10 rounded-full text-emerald-600"><CheckCircle2 className="w-4 h-4" /></div>
                  <span className="text-2xl font-bold text-emerald-600">R$ {paidCommissionAmount.toFixed(2)}</span>
               </div>
            </Card>
            <Card className="bg-white dark:bg-stone-900 border-stone-100 dark:border-stone-800 shadow-sm p-4 flex flex-col justify-center">
               <span className="text-xs text-stone-400 uppercase font-semibold mb-1">Pendente</span>
               <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-500/10 rounded-full text-amber-600"><Clock className="w-4 h-4" /></div>
                  <span className="text-2xl font-bold text-amber-600">R$ {pendingCommissionAmount.toFixed(2)}</span>
               </div>
            </Card>
          </div>

          <div className="space-y-4">
             {Object.keys(commissionsByStaff).length === 0 && (
                <div className="text-center py-12 text-stone-400">Nenhuma comissão registrada neste período.</div>
             )}
             
             {Object.keys(commissionsByStaff).map(staffId => {
                const list = commissionsByStaff[staffId];
                const total = list.reduce((acc, c) => acc + c.commission_amount_centavos, 0);
                const pending = list.filter(c => c.status === 'pendente_pagamento').reduce((acc, c) => acc + c.commission_amount_centavos, 0);
                
                return (
                  <Accordion type="single" collapsible key={staffId} className="bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                    <AccordionItem value={staffId} className="border-0">
                      <AccordionTrigger className="px-6 py-4 hover:bg-stone-50/50 dark:hover:bg-stone-900/50 no-underline hover:no-underline">
                         <div className="flex flex-col md:flex-row justify-between w-full pr-4 items-start md:items-center gap-2">
                            <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center font-bold text-stone-500 text-xs">
                                  {getStaffName(staffId).charAt(0)}
                               </div>
                               <div className="text-left">
                                  <div className="font-bold text-stone-800 dark:text-stone-100">{getStaffName(staffId)}</div>
                                  <div className="text-xs text-stone-400">{list.length} serviços</div>
                               </div>
                            </div>
                            <div className="flex gap-4 text-sm">
                               {pending > 0 && (
                                 <div className="flex flex-col items-end">
                                    <span className="text-[10px] text-stone-400 uppercase">A Pagar</span>
                                    <span className="font-bold text-amber-600">R$ {(pending/100).toFixed(2)}</span>
                                 </div>
                               )}
                               <div className="flex flex-col items-end min-w-[80px]">
                                  <span className="text-[10px] text-stone-400 uppercase">Total</span>
                                  <span className="font-bold text-stone-800 dark:text-stone-200">R$ {(total/100).toFixed(2)}</span>
                               </div>
                            </div>
                         </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-0 pb-0 bg-stone-50/30 dark:bg-stone-950/30 border-t border-stone-100 dark:border-stone-800">
                         {list.map(com => {
                           const isPaid = com.status === 'pago';
                           const dateObj = new Date(com.date + 'T12:00:00');
                           return (
                             <div key={com.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border-b border-stone-100 last:border-0 dark:border-stone-800 text-sm hover:bg-white dark:hover:bg-stone-900 transition-colors">
                                <div className="flex gap-3 mb-2 md:mb-0">
                                   <div className={`mt-1 w-2 h-2 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                                   <div>
                                      <div className="font-medium text-stone-700 dark:text-stone-300">{com.service_name || 'Serviço'}</div>
                                      <div className="text-xs text-stone-400 flex items-center gap-1">
                                         <CalendarDays className="w-3 h-3" /> {format(dateObj, 'dd/MM/yyyy')}
                                         <span className="mx-1">•</span>
                                         {com.commission_percentage}%
                                      </div>
                                   </div>
                                </div>
                                
                                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                                   <div className="text-right">
                                      <div className="font-bold text-stone-700 dark:text-stone-200">R$ {(com.commission_amount_centavos/100).toFixed(2)}</div>
                                      {isPaid && com.payment_date && <div className="text-[10px] text-emerald-600">Pago em {format(new Date(com.payment_date + 'T12:00:00'), 'dd/MM')}</div>}
                                   </div>
                                   
                                   <div className="flex gap-2">
                                      {/* BOTÃO NOVO: VER NA AGENDA */}
                                      <Button size="icon" variant="ghost" className="h-8 w-8 text-stone-400 hover:text-[#C6A87C]" onClick={() => navigate(`/appointments?date=${format(dateObj, 'yyyy-MM-dd')}`)} title="Ver na Agenda">
                                         <ArrowUpRight className="w-4 h-4" />
                                      </Button>

                                      <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                             <Button size="icon" variant="ghost" className="h-8 w-8 text-stone-400 hover:text-[#C6A87C]"><MoreHorizontal className="w-4 h-4" /></Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                             {!isPaid && (
                                                <DropdownMenuItem onClick={() => updateCommissionStatus.mutate({ id: com.id, status: 'pago', payment_date: format(new Date(), 'yyyy-MM-dd') })}>
                                                   <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" /> Confirmar Pagamento
                                                </DropdownMenuItem>
                                             )}
                                             <DropdownMenuItem className="text-red-500 focus:text-red-600" onClick={() => deleteCommission.mutate(com.id)}>
                                                <Trash2 className="w-4 h-4 mr-2" /> Excluir Lançamento
                                             </DropdownMenuItem>
                                          </DropdownMenuContent>
                                       </DropdownMenu>
                                   </div>
                                </div>
                             </div>
                           );
                         })}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )
             })}
          </div>
        </div>
      )}

    </div>
  );
}
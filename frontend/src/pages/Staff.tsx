import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Calendar, DollarSign, Umbrella, Pencil, Trash2, Check, X, MapPin, Paintbrush, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { format, startOfWeek, addDays, addWeeks, subWeeks, subMonths, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfDay, endOfDay, endOfWeek, isSameMonth, isToday, differenceInDays } from "date-fns";
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

// --- Tipagem (sem alterações) ---
interface StaffMember { id: string; name: string; full_name?: string; role: string; active: boolean; work_locations: string[]; services: string[]; default_commission_percentage?: number; }
interface Service { id: string; name: string; }
interface StaffService { staff_id: string; service_id: string; service_name?: string; }
interface StaffShift { id?: number; staff_id: string; location_id: string; weekday: number; start_time: string; end_time: string; }
interface StaffException { id: string; staff_id: string; staff_name?: string; start_date: string; end_date: string; type: 'folga' | 'férias' | 'atestado'; status: 'aprovado' | 'pendente' | 'rejeitado'; notes?: string; }
interface StaffCommission { id: string; staff_id: string; staff_name?: string; service_id: string; service_name?: string; date: string; service_price_centavos: number; commission_percentage: number; commission_amount_centavos: number; status: 'pendente_pagamento' | 'pago' | 'cancelado'; payment_date?: string; notes?: string; }
interface Location { id: string; name: string; }

// --- Componentes Modais e Funções Auxiliares (sem alterações) ---
// ... (Todo o código dos modais e funções auxiliares permanece o mesmo) ...
const ALL_LOCATIONS_VALUE = "all-locations-filter";
interface SimplifiedStaffCardProps extends StaffMember { statusInfo: React.ReactNode; onEdit: () => void; }
function SimplifiedStaffCard({ name, role, active, work_locations, services, statusInfo, onEdit }: SimplifiedStaffCardProps) { return (<Card className="flex flex-col h-full hover:border-primary transition-colors group"><CardHeader><div className="flex justify-between items-start"><div><CardTitle className="text-lg">{name}</CardTitle><p className="text-sm text-muted-foreground">{role}</p></div><Badge variant={active ? "default" : "destructive"}>{active ? "Ativo" : "Inativo"}</Badge></div></CardHeader><CardContent className="flex-1 space-y-3 text-sm"><div className="flex items-center gap-2 text-muted-foreground"><MapPin className="w-4 h-4" /><span>Trabalha em: <strong>{work_locations.join(', ')}</strong></span></div><div className="flex items-center gap-2 text-muted-foreground"><Paintbrush className="w-4 h-4" /><span><strong>{services?.length ?? 0}</strong> serviços habilitados</span></div><div className="flex items-center gap-2 text-sm pt-3 border-t"><Clock className="w-4 h-4 text-primary" /><span className="text-foreground">{statusInfo}</span></div></CardContent><DialogFooter className="p-4 pt-0"><Button variant="outline" size="sm" className="w-full" onClick={onEdit}><Pencil className="w-3 h-3 mr-2" />Editar Detalhes</Button></DialogFooter></Card>); }
const getLocationNameById = (locationId: string, locations: Location[]): string => { return locations.find(l => l.id === locationId)?.name || 'Desconhecida'; };
const getSchedulesForStaffAndDay = (staffId: string, dayOfWeek: number, shifts: StaffShift[], selectedLocationName: string, locations: Location[]): StaffShift[] => { const dbWeekday = dayOfWeek === 0 ? 7 : dayOfWeek; const selectedLocationId = locations.find(l => l.name === selectedLocationName)?.id; return shifts.filter(s => { const matchesDay = s.staff_id === staffId && s.weekday === dbWeekday; if (!selectedLocationName) return matchesDay; return matchesDay && (s.location_id === selectedLocationId); }); };
const hasTimeOffOnDate = (staffId: string, date: Date, exceptions: StaffException[]): StaffException | undefined => { return exceptions.find(exc => { const excStart = startOfDay(new Date(exc.start_date)).getTime(); const excEnd = endOfDay(new Date(exc.end_date)).getTime(); const dateToCheck = startOfDay(date).getTime(); return exc.staff_id === staffId && exc.status === 'aprovado' && dateToCheck >= excStart && dateToCheck <= excEnd; }); };
const timeOffTypeColors: Record<string, string> = { férias: "bg-blue-500", folga: "bg-amber-500", atestado: "bg-red-500" };
const statusColors: Record<string, string> = { aprovado: "bg-green-500", pendente: "bg-amber-500", rejeitado: "bg-red-500", pago: "bg-green-500", pendente_pagamento: "bg-amber-500", cancelado: "bg-red-500" };
interface ShiftPayload { id?: number; staff_id: string; location_id: string; weekday: number; start_time: string; end_time: string; }
interface ShiftEditModalProps { shiftData: ShiftPayload | null; staffName: string; allLocations: Location[]; onClose: () => void; onSave: (payload: ShiftPayload) => void; onDelete: (id: number) => void; isSaving: boolean; isDeleting: boolean; }
function ShiftEditModal({ shiftData, staffName, allLocations, onClose, onSave, onDelete, isSaving, isDeleting }: ShiftEditModalProps) { const isEditing = !!shiftData?.id; const initialLocationId = shiftData?.location_id || allLocations[0]?.id || ''; const [startTime, setStartTime] = useState(shiftData?.start_time.substring(0, 5) || '09:00'); const [endTime, setEndTime] = useState(shiftData?.end_time.substring(0, 5) || '18:00'); const [selectedLocationId, setSelectedLocationId] = useState(initialLocationId); useEffect(() => { const currentInitialLocationId = shiftData?.location_id || allLocations[0]?.id || ''; setStartTime(shiftData?.start_time.substring(0, 5) || '09:00'); setEndTime(shiftData?.end_time.substring(0, 5) || '18:00'); setSelectedLocationId(currentInitialLocationId); }, [shiftData, allLocations]); const handleSave = () => { if (shiftData && selectedLocationId && startTime && endTime) { const payload: ShiftPayload = { id: shiftData.id, staff_id: shiftData.staff_id, weekday: shiftData.weekday, start_time: `${startTime}:00`, end_time: `${endTime}:00`, location_id: selectedLocationId }; onSave(payload); } }; const handleDelete = () => { if (shiftData?.id && confirm(`Tem certeza que deseja APAGAR o turno de ${staffName} (${startTime} - ${endTime})?`)) { onDelete(shiftData.id as number); } }; if (!shiftData) return null; const weekdayMap = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']; const dayName = weekdayMap[shiftData.weekday % 7]; const currentLocationName = allLocations.find(loc => loc.id === selectedLocationId)?.name || 'Unidade Inválida'; return (<Dialog open={!!shiftData} onOpenChange={onClose}><DialogContent className="sm:max-w-[425px]"><DialogHeader><DialogTitle>{isEditing ? 'Editar Turno' : 'Criar Novo Turno'} de {staffName}</DialogTitle><div className="text-sm text-muted-foreground">{dayName} na unidade {currentLocationName}</div></DialogHeader><div className="grid gap-4 py-4"><div><Label htmlFor="location_select">Unidade</Label><Select value={selectedLocationId} onValueChange={setSelectedLocationId} disabled={isSaving || isDeleting}><SelectTrigger id="location_select" className="w-full"><SelectValue placeholder="Selecione a Unidade" /></SelectTrigger><SelectContent>{allLocations.map(loc => (<SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>))}</SelectContent></Select></div><div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="start_time" className="text-right">Início</Label><Input id="start_time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="col-span-3" disabled={isSaving || isDeleting} /></div><div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="end_time" className="text-right">Fim</Label><Input id="end_time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="col-span-3" disabled={isSaving || isDeleting} /></div></div><DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between sm:space-x-2">{isEditing && (<Button variant="destructive" onClick={handleDelete} disabled={isDeleting || isSaving} className="w-full sm:w-auto mt-2 sm:mt-0 px-3" title="Apagar Turno">{isDeleting ? "Apagando..." : <Trash2 className="w-5 h-5" />}</Button>)}<div className="flex justify-end gap-2 w-full sm:w-auto"><Button variant="outline" onClick={onClose} disabled={isSaving || isDeleting} className="w-full sm:w-auto">Cancelar</Button><Button onClick={handleSave} disabled={isSaving || isDeleting || !startTime || !endTime || !selectedLocationId} className="w-full sm:w-auto">{isSaving ? "Salvando..." : (isEditing ? "Salvar Alterações" : "Criar Turno")}</Button></div></DialogFooter></DialogContent></Dialog>); }
interface StaffDetailModalProps { member: StaffMember | null; allServices: Service[]; staffServices: StaffService[]; onClose: () => void; onSave: (payload: { staffData: Partial<StaffMember>, servicesToAdd: string[], servicesToRemove: string[] }) => void; isSaving: boolean; }
function StaffDetailModal({ member, allServices, staffServices, onClose, onSave, isSaving }: StaffDetailModalProps) { const [name, setName] = useState(member?.name || ''); const [role, setRole] = useState(member?.role || ''); const [active, setActive] = useState(member?.active ?? true); const [commission, setCommission] = useState(member?.default_commission_percentage ?? 0); const [selectedServices, setSelectedServices] = useState<string[]>([]); useEffect(() => { if (member) { setName(member.name); setRole(member.role || ''); setActive(member.active ?? true); setCommission(member.default_commission_percentage ?? 0); const memberServiceIds = staffServices.filter(ss => ss.staff_id === member.id).map(ss => ss.service_id); setSelectedServices(memberServiceIds); } }, [member, staffServices]); const originalServiceIds = useMemo(() => staffServices.filter(ss => ss.staff_id === member?.id).map(ss => ss.service_id), [member, staffServices]); const handleServiceToggle = (serviceId: string) => { setSelectedServices(prev => prev.includes(serviceId) ? prev.filter(id => id !== serviceId) : [...prev, serviceId] ); }; const handleSave = () => { if (!member) return; const staffData: Partial<StaffMember> = { id: member.id, name: name, role: role, active: active, default_commission_percentage: commission, }; const servicesToAdd = selectedServices.filter(id => !originalServiceIds.includes(id)); const servicesToRemove = originalServiceIds.filter(id => !selectedServices.includes(id)); onSave({ staffData, servicesToAdd, servicesToRemove }); }; if (!member) return null; return (<Dialog open={!!member} onOpenChange={onClose}><DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{member?.id ? `Editar Profissional: ${member.name}` : 'Cadastrar Novo Profissional'}</DialogTitle></DialogHeader><div className="grid gap-4 py-4"><h4 className="text-lg font-semibold border-b pb-2">Detalhes Básicos</h4><div className="grid grid-cols-2 gap-4"><div><Label htmlFor="staff_name">Nome</Label><Input id="staff_name" value={name} onChange={(e) => setName(e.target.value)} disabled={isSaving} /></div><div><Label htmlFor="staff_role">Cargo/Função</Label><Input id="staff_role" value={role} onChange={(e) => setRole(e.target.value)} disabled={isSaving} /></div></div><div className="grid grid-cols-2 gap-4"><div><Label htmlFor="staff_active">Status</Label><Select value={active ? 'active' : 'inactive'} onValueChange={(v) => setActive(v === 'active')} disabled={isSaving}><SelectTrigger id="staff_active"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Ativo</SelectItem><SelectItem value="inactive">Inativo</SelectItem></SelectContent></Select></div><div><Label htmlFor="staff_commission">Comissão Fixa Padrão (%)</Label><Input id="staff_commission" type="number" step="0.01" min="0" max="100" value={commission} onChange={(e) => setCommission(parseFloat(e.target.value))} disabled={isSaving} /></div></div><h4 className="text-lg font-semibold border-b pb-2 mt-4">Serviços Habilitados</h4><div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto border p-3 rounded">{allServices.map(service => (<Button key={service.id} variant={selectedServices.includes(service.id) ? "default" : "outline"} size="sm" onClick={() => handleServiceToggle(service.id)} disabled={isSaving} className="transition-colors">{service.name}</Button>))
}{allServices.length === 0 && <p className="text-muted-foreground">Nenhum serviço cadastrado.</p>}</div><p className="text-sm text-muted-foreground mt-2">* A **Unidade de Trabalho** é configurada e editada exclusivamente na aba **Escala**, através da edição dos Turnos de Trabalho.</p></div><DialogFooter><Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button><Button onClick={handleSave} disabled={isSaving || !name}>{isSaving ? "Salvando..." : "Salvar Tudo"}</Button></DialogFooter></DialogContent></Dialog>); }
function TimeOffModal({ staff }: { staff: StaffMember[] }) { const [open, setOpen] = useState(false); const [formData, setFormData] = useState({ staff_id: "", start_date: format(new Date(), "yyyy-MM-dd"), end_date: format(new Date(), "yyyy-MM-dd"), type: "folga" as "folga" | "férias" | "atestado", notes: "" }); const queryClient = useQueryClient(); const mutation = useMutation({ mutationFn: (data: any) => staffExceptionsAPI.create({ staff_id: data.staff_id, start_date: data.start_date, end_date: data.end_date, type: data.type, notes: data.notes }), onSuccess: () => { toast.success("Folga/Férias cadastrada com sucesso!"); setOpen(false); setFormData({ staff_id: "", start_date: format(new Date(), "yyyy-MM-dd"), end_date: format(new Date(), "yyyy-MM-dd"), type: "folga", notes: "" }); queryClient.invalidateQueries({ queryKey: ['staffExceptions'] }); }, onError: () => toast.error("Erro ao cadastrar") }); const isFormValid = formData.staff_id && formData.start_date && formData.end_date; return (<Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Nova Folga/Férias</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Cadastrar Folga/Férias/Atestado</DialogTitle></DialogHeader><div className="space-y-4"><div><Label htmlFor="staff_id">Profissional</Label><Select value={formData.staff_id} onValueChange={(v) => setFormData({ ...formData, staff_id: v })}><SelectTrigger id="staff_id"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="type">Tipo</Label><Select value={formData.type} onValueChange={(v: any) => setFormData({ ...formData, type: v })}><SelectTrigger id="type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="folga">Folga</SelectItem><SelectItem value="férias">Férias</SelectItem><SelectItem value="atestado">Atestado</SelectItem></SelectContent></Select></div><div className="grid grid-cols-2 gap-4"><div><Label htmlFor="start_date">Data Início</Label><Input id="start_date" type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} /></div><div><Label htmlFor="end_date">Data Fim</Label><Input id="end_date" type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} /></div></div><div><Label htmlFor="notes">Observações</Label><Textarea id="notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} /></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => mutation.mutate(formData)} disabled={mutation.isPending || !isFormValid}>{mutation.isPending ? "Salvando..." : "Salvar"}</Button></DialogFooter></DialogContent></Dialog>); }
function CommissionModal({ staff, services }: { staff: StaffMember[]; services: Service[] }) { const [open, setOpen] = useState(false); const [formData, setFormData] = useState({ staff_id: "", service_id: "", date: format(new Date(), "yyyy-MM-dd"), service_price_centavos: 0, commission_percentage: 0 }); const queryClient = useQueryClient(); useEffect(() => { if (formData.staff_id) { const selectedStaff = staff.find(s => s.id === formData.staff_id); if (selectedStaff) { setFormData(prevData => ({ ...prevData, commission_percentage: selectedStaff.default_commission_percentage || 0 })); } } }, [formData.staff_id, staff]); const commissionAmount = useMemo(() => (formData.service_price_centavos * formData.commission_percentage) / 100, [formData.service_price_centavos, formData.commission_percentage]); const mutation = useMutation({ mutationFn: (data: typeof formData) => { const apiPayload = { staff: data.staff_id, service: data.service_id, date: data.date, service_price_centavos: data.service_price_centavos, commission_percentage: data.commission_percentage, commission_amount_centavos: commissionAmount, status: "pendente_pagamento" }; return staffCommissionsAPI.create(apiPayload); }, onSuccess: () => { toast.success("Comissão cadastrada com sucesso!"); setOpen(false); setFormData({ staff_id: "", service_id: "", date: format(new Date(), "yyyy-MM-dd"), service_price_centavos: 0, commission_percentage: 0 }); queryClient.invalidateQueries({ queryKey: ['staffCommissions'] }); }, onError: (error: Error) => { console.error("Erro ao cadastrar comissão:", error); toast.error(`Erro ao cadastrar: ${error.message}`); } }); const isFormValid = formData.staff_id && formData.service_id && formData.service_price_centavos > 0 && formData.commission_percentage >= 0; return (<Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Nova Comissão</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Cadastrar Comissão</DialogTitle></DialogHeader><div className="space-y-4"><div><Label htmlFor="c_staff_id">Profissional</Label><Select value={formData.staff_id} onValueChange={(v) => setFormData({ ...formData, staff_id: v })}><SelectTrigger id="c_staff_id"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="c_service_id">Serviço</Label><Select value={formData.service_id} onValueChange={(v) => setFormData({ ...formData, service_id: v })}><SelectTrigger id="c_service_id"><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="c_date">Data</Label><Input id="c_date" type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} /></div><div className="grid grid-cols-2 gap-4"><div><Label htmlFor="c_price">Valor do Serviço (R$)</Label><Input id="c_price" type="number" step="0.01" value={formData.service_price_centavos / 100} onChange={(e) => setFormData({ ...formData, service_price_centavos: parseFloat(e.target.value) * 100 })} /></div><div><Label htmlFor="c_percentage">Comissão (%)</Label><Input id="c_percentage" type="number" step="0.01" max="100" value={formData.commission_percentage} onChange={(e) => setFormData({ ...formData, commission_percentage: parseFloat(e.target.value) })} /></div></div><div className="bg-muted p-3 rounded"><p className="text-sm text-muted-foreground">Valor da Comissão</p><p className="text-2xl font-bold">R$ {(commissionAmount / 100).toFixed(2)}</p></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={() => mutation.mutate(formData)} disabled={mutation.isPending || !isFormValid}>{mutation.isPending ? "Salvando..." : "Salvar"}</Button></DialogFooter></DialogContent></Dialog>); }


// --- Componente Principal ---
export default function Staff() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // ✅ PASSO 2.1: FUNÇÃO PARA LER PARÂMETROS DA URL
  const getQueryParam = (param: string): string | null => {
    // Garante que o código só rode no navegador
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        return params.get(param);
    }
    return null;
  };

  // ✅ PASSO 2.2: INICIALIZAR ESTADOS A PARTIR DA URL
  const [activeTab, setActiveTab] = useState(getQueryParam('tab') || 'team');
  const [commissionStatusFilter, setCommissionStatusFilter] = useState<string>(getQueryParam('status') || "all");

  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [scheduleView, setScheduleView] = useState<"week" | "month">("week");
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [exceptionStatusFilter, setExceptionStatusFilter] = useState<string>("pendente");
  const [commissionMonthFilter, setCommissionMonthFilter] = useState(format(new Date(), 'yyyy-MM'));
  const [editingShiftData, setEditingShiftData] = useState<ShiftPayload | null>(null);
  const [editingStaffMember, setEditingStaffMember] = useState<StaffMember | null>(null);

  // ... (Restante do código, hooks, useMemo, etc., sem alterações) ...
  const weekStart = startOfWeek(currentWeek, { locale: ptBR });
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [currentWeek]);
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { locale: ptBR });
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });
  const monthDays = useMemo(() => eachDayOfInterval({ start: calendarStart, end: calendarEnd }), [monthStart, monthEnd]);
  const { data: rawStaff = [], isLoading: isLoadingStaff } = useQuery<any[]>({ queryKey: ['staff'], queryFn: staffAPI.getAll });
  const { data: services = [], isLoading: isLoadingServices } = useQuery<Service[]>({ queryKey: ['services'], queryFn: servicesAPI.getAll });
  const { data: staffServices = [] } = useQuery<StaffService[]>({ queryKey: ['staffServices'], queryFn: staffServicesAPI.getAll });
  const { data: staffShifts = [] } = useQuery<StaffShift[]>({ queryKey: ['staffShifts'], queryFn: staffShiftsAPI.getAll });
  const { data: exceptions = [] } = useQuery<StaffException[]>({ queryKey: ['staffExceptions'], queryFn: staffExceptionsAPI.getAll });
  const { data: commissions = [] } = useQuery<StaffCommission[]>({ queryKey: ['staffCommissions'], queryFn: staffCommissionsAPI.getAll });
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ['locations'], queryFn: locationsAPI.getAll });
  const loading = isLoadingStaff || isLoadingServices;
  const staffWithDetails = useMemo<StaffMember[]>(() => { const serviceMap = services.reduce((acc, s) => ({ ...acc, [s.id]: s.name }), {} as Record<string, string>); const servicesByStaff = staffServices.reduce((acc, ss) => { const staffId = ss.staff_id || (ss as any).staff; const serviceId = ss.service_id || (ss as any).service; if (!acc[staffId]) acc[staffId] = []; if (serviceMap[serviceId]) acc[staffId].push(serviceMap[serviceId]); return acc; }, {} as Record<string, string[]>); return rawStaff.map(member => { const memberShifts = staffShifts.filter(s => s.staff_id === member.id); const locationIds = memberShifts.reduce((acc: string[], shift) => { if (!acc.includes(shift.location_id)) { acc.push(shift.location_id); } return acc; }, []); const work_locations = locationIds.map(id => locations.find(l => l.id === id)?.name).filter((name): name is string => !!name); return { ...member, services: servicesByStaff[member.id] || [], name: member.full_name || member.name, active: member.active ?? true, role: member.role || 'Profissional', work_locations: work_locations.length > 0 ? work_locations : ['Sem Turno Definido'], }; }); }, [rawStaff, staffServices, services, staffShifts, locations]);
  const activeStaff = useMemo(() => staffWithDetails.filter(s => s.active), [staffWithDetails]);
  const filteredStaff = useMemo(() => { if (!selectedLocation) return staffWithDetails; return staffWithDetails.filter(s => s.work_locations.includes(selectedLocation)); }, [staffWithDetails, selectedLocation]);
  const filteredExceptions = useMemo(() => { return exceptions.filter(exc => { const matchStatus = exceptionStatusFilter === 'all' || exc.status === exceptionStatusFilter; const staffMember = staffWithDetails.find(s => s.id === exc.staff_id); const matchLocation = !selectedLocation || (staffMember && staffMember.work_locations.includes(selectedLocation)); return matchStatus && matchLocation; }); }, [exceptions, exceptionStatusFilter, selectedLocation, staffWithDetails]);
  const filteredCommissions = useMemo(() => { return commissions.filter(c => { const matchStatus = commissionStatusFilter === 'all' || c.status === commissionStatusFilter; const commissionDate = new Date(`${c.date}T12:00:00`); const matchMonth = format(commissionDate, 'yyyy-MM') === commissionMonthFilter; const staffMember = staffWithDetails.find(s => s.id === c.staff_id); const matchLocation = !selectedLocation || (staffMember && staffMember.work_locations.includes(selectedLocation)); return matchStatus && matchMonth && matchLocation; }); }, [commissions, commissionStatusFilter, commissionMonthFilter, selectedLocation, staffWithDetails]);
  const totalCommissionAmount = filteredCommissions.reduce((sum, c) => sum + c.commission_amount_centavos, 0) / 100;
  const totalAppointments = filteredCommissions.length;
  const commissionsByStaff = useMemo(() => { return filteredCommissions.reduce((acc, commission) => { const staffId = commission.staff_id; if (!acc[staffId]) { acc[staffId] = []; } acc[staffId].push(commission); return acc; }, {} as Record<string, StaffCommission[]>); }, [filteredCommissions]);
  const deleteException = useMutation({ mutationFn: (id: string) => staffExceptionsAPI.delete(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staffExceptions'] }); toast.success("Excluído com sucesso! 🗑️"); }, onError: () => toast.error("Erro ao excluir. Verifique permissões.") });
  const deleteCommission = useMutation({ mutationFn: (id: string) => staffCommissionsAPI.delete(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staffCommissions'] }); toast.success("Comissão excluída! 🗑️"); }, onError: () => toast.error("Erro ao excluir a comissão.") });
  const updateExceptionStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: 'aprovado' | 'rejeitado' | 'pendente' }) => staffExceptionsAPI.update(id, { status: status }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staffExceptions'] }); toast.success("Status atualizado! 👍"); }, onError: (error) => { console.error("Erro ao atualizar status:", error); toast.error("Erro ao atualizar status. O backend precisa aceitar PATCH no ID."); } });
  const updateCommissionStatus = useMutation({ mutationFn: ({ id, status, payment_date }: { id: string; status: 'pago' | 'cancelado' | 'pendente_pagamento'; payment_date?: string }) => staffCommissionsAPI.update(id, { status, payment_date }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staffCommissions'] }); toast.success("Comissão atualizada! 💰"); }, onError: () => toast.error("Erro ao atualizar comissão.") });
  const saveShift = useMutation({ mutationFn: (payload: ShiftPayload) => { const apiPayload = { staff: payload.staff_id, location: payload.location_id, weekday: payload.weekday, start_time: payload.start_time, end_time: payload.end_time, }; if (payload.id) { return staffShiftsAPI.update(payload.id, apiPayload); } else { return staffShiftsAPI.create(apiPayload); } }, onSuccess: () => { toast.success("Escala salva com sucesso!"); setEditingShiftData(null); queryClient.invalidateQueries({ queryKey: ['staffShifts'] }); }, onError: (error: Error) => { console.error("Erro ao salvar o turno:", error); if (error.message.includes("400")) { toast.error("Erro de validação: Verifique os dados enviados."); } else { toast.error("Erro ao salvar o turno. Verifique a conexão com a API."); } } });
  const deleteShift = useMutation({ mutationFn: (id: number) => staffShiftsAPI.delete(id), onSuccess: () => { toast.success("Turno excluído com sucesso! 🗑️"); setEditingShiftData(null); queryClient.invalidateQueries({ queryKey: ['staffShifts'] }); }, onError: () => { toast.error("Erro ao excluir o turno."); } });
  const saveStaffDetails = useMutation({ mutationFn: async ({ staffData, servicesToAdd, servicesToRemove }: { staffData: Partial<StaffMember>, servicesToAdd: string[], servicesToRemove: string[] }) => { const isNew = !editingStaffMember?.id; let staffId = editingStaffMember?.id; if (isNew) { const { id, ...createData } = staffData; const newStaff = await staffAPI.create(createData); staffId = newStaff.id; } else { if (!staffId) throw new Error("ID do profissional não encontrado."); await staffAPI.update(staffId, staffData); } if (staffId) { const addServicesPromises = servicesToAdd.map(newServiceId => staffServicesAPI.create({ staff: staffId, service: newServiceId }) ); const removeServicesPromises = servicesToRemove.map(service_id => staffServicesAPI.delete(`delete-by-params/?staff_id=${staffId}&service_id=${service_id}`) ); await Promise.all([...addServicesPromises, ...removeServicesPromises]); } return staffId; }, onSuccess: () => { toast.success("Dados do profissional salvos com sucesso!"); setEditingStaffMember(null); queryClient.invalidateQueries({ queryKey: ['staff'] }); queryClient.invalidateQueries({ queryKey: ['staffServices'] }); }, onError: (error: Error) => { console.error("Erro ao salvar detalhes do profissional:", error); if (error.message.includes("401")) { toast.error("Sessão expirada! Por favor, faça login novamente."); } else { toast.error("Erro ao salvar. Verifique se os dados estão válidos."); } } });
  const getStaffName = useCallback((id: string | undefined) => rawStaff.find(s => s.id === id)?.name || `ID: ${id}`, [rawStaff]);
  const handleNewProfessionalClick = () => { const newStaffTemplate: StaffMember = { id: '', name: '', role: 'Profissional', active: true, default_commission_percentage: 0, work_locations: [], services: [], }; setEditingStaffMember(newStaffTemplate); };
  const handleCommissionMonthChange = (direction: 'next' | 'prev') => { const currentDate = new Date(commissionMonthFilter + '-02T12:00:00'); const newDate = direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1); setCommissionMonthFilter(format(newDate, 'yyyy-MM')); };
  const displayCommissionMonth = useMemo(() => { const date = new Date(commissionMonthFilter + '-02T12:00:00'); const formatted = format(date, 'MMM/yyyy', { locale: ptBR }); return formatted.charAt(0).toUpperCase() + formatted.slice(1); }, [commissionMonthFilter]);
  const handleMonthDayClick = (day: Date) => { const formattedDate = format(day, "yyyy-MM-dd"); navigate(`/appointments?date=${formattedDate}`); };
  if (loading) { return <div className="p-6 text-center text-muted-foreground">Carregando dados...</div>; }
  const handleLocationChange = (value: string) => { setSelectedLocation(value === ALL_LOCATIONS_VALUE ? "" : value); };
  const currentSelectedLocationValue = selectedLocation || ALL_LOCATIONS_VALUE;
  const handleShiftCellClick = (member: StaffMember, day: Date, shift: StaffShift | undefined) => { const defaultLocation = member.work_locations[0]; const defaultLocationObj = locations.find(l => l.name === defaultLocation); const defaultLocationId = defaultLocationObj ? defaultLocationObj.id : (locations.length > 0 ? locations[0].id : ''); const dbWeekday = day.getDay() === 0 ? 7 : day.getDay(); if (!member.active && !shift) { toast.info("Não é possível criar turno: Profissional está inativo."); return; } if (shift) { const dataToEdit: ShiftPayload = { ...shift, staff_id: member.id, weekday: dbWeekday, }; setEditingShiftData(dataToEdit); } else { if (!defaultLocationId) { toast.error("Unidade não encontrada. Cadastre uma unidade primeiro."); return; } const dataToCreate: ShiftPayload = { staff_id: member.id, location_id: defaultLocationId, weekday: dbWeekday, start_time: '09:00:00', end_time: '18:00:00', }; setEditingShiftData(dataToCreate); } };
  const getStaffStatusForToday = (member: StaffMember) => { const today = new Date(); const todayWeekday = today.getDay(); const timeOff = hasTimeOffOnDate(member.id, today, exceptions); if (timeOff) { return (<span className="font-semibold text-amber-600">{timeOff.type.charAt(0).toUpperCase() + timeOff.type.slice(1)}</span>); } const todayShifts = getSchedulesForStaffAndDay(member.id, todayWeekday, staffShifts, selectedLocation, locations); if (todayShifts.length > 0) { const firstShift = todayShifts[0]; const locationName = getLocationNameById(firstShift.location_id, locations); return (<span><strong>Hoje:</strong> {firstShift.start_time.substring(0, 5)} - {firstShift.end_time.substring(0, 5)} ({locationName})</span>); } return <span className="text-muted-foreground">Sem turno hoje</span>; };

  return (
    <div className="p-6 space-y-6">
      {/* Modais (sem alterações) */}
      <ShiftEditModal shiftData={editingShiftData} staffName={editingShiftData ? getStaffName(editingShiftData.staff_id) : ''} allLocations={locations} onClose={() => setEditingShiftData(null)} onSave={(payload) => saveShift.mutate(payload)} onDelete={(id) => deleteShift.mutate(id as number)} isSaving={saveShift.isPending} isDeleting={deleteShift.isPending} />
      <StaffDetailModal member={editingStaffMember} allServices={services} staffServices={staffServices} onClose={() => setEditingStaffMember(null)} onSave={saveStaffDetails.mutate} isSaving={saveStaffDetails.isPending} />
      
      {/* Título (sem alterações) */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Profissionais</h1>
          <p className="text-muted-foreground">Gerencie sua equipe</p>
        </div>
        <Button onClick={handleNewProfessionalClick}><Plus className="w-4 h-4 mr-2" />Novo Profissional</Button>
      </div>

      {/* ✅ PASSO 2.3: TORNAR O COMPONENTE DE ABAS CONTROLADO */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="team">Equipe</TabsTrigger>
          <TabsTrigger value="schedule">Escala</TabsTrigger>
          <TabsTrigger value="timeoff">Folgas/Férias</TabsTrigger>
          <TabsTrigger value="commissions">Comissões</TabsTrigger>
        </TabsList>

        {/* Todas as TabsContent permanecem exatamente as mesmas */}
        <TabsContent value="team" className="space-y-6">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-muted-foreground" />
            <Select value={currentSelectedLocationValue} onValueChange={handleLocationChange}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Filtrar por unidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_LOCATIONS_VALUE}>Todas as unidades</SelectItem>
                {locations.map(loc => <SelectItem key={loc.id} value={loc.name}>{loc.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStaff.map(s => {
              const statusInfo = getStaffStatusForToday(s);
              return (
                <SimplifiedStaffCard 
                  key={s.id}
                  {...s}
                  statusInfo={statusInfo}
                  onEdit={() => setEditingStaffMember(s)}
                />
              );
            })}
            {filteredStaff.length === 0 && (
              <p className="text-muted-foreground col-span-full p-6 text-center">Nenhum profissional encontrado nesta unidade.</p>
            )}
          </div>
        </TabsContent>
        <TabsContent value="schedule" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentWeek(scheduleView === "week" ? subWeeks(currentWeek, 1) : subMonths(currentMonth, 1))}>
                Anterior
              </Button>
              <span className="text-sm font-medium text-foreground">
                {scheduleView === "week"
                  ? `${format(weekStart, "dd MMM", { locale: ptBR })} - ${format(addDays(weekStart, 6), "dd MMM yyyy", { locale: ptBR })}`
                  : format(currentMonth, "MMMM yyyy", { locale: ptBR })}
              </span>
              <Button variant="outline" size="sm" onClick={() => setCurrentWeek(scheduleView === "week" ? addWeeks(currentWeek, 1) : addMonths(currentMonth, 1))}>
                Próximo
              </Button>
            </div>
            <div className="flex gap-2">
              <Select value={scheduleView} onValueChange={(v: any) => setScheduleView(v)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Semanal</SelectItem>
                  <SelectItem value="month">Mensal</SelectItem>
                </SelectContent>
              </Select>
              <Select value={currentSelectedLocationValue} onValueChange={handleLocationChange}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_LOCATIONS_VALUE}>Todas</SelectItem>
                  {locations.map(loc => <SelectItem key={loc.id} value={loc.name}>{loc.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {scheduleView === "week" && (
            <Card className="p-6 overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 text-sm font-semibold text-foreground w-[180px]">Profissional</th>
                    {weekDays.map((day, idx) => (
                      <th key={idx} className="text-center p-3 text-sm font-semibold text-foreground w-[100px]">
                        <div>{format(day, "EEE", { locale: ptBR })}</div>
                        <div className="text-xs text-muted-foreground">{format(day, "dd/MM")}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map(member => (
                    <tr key={member.id} className="border-b hover:bg-muted/50">
                      <td className="p-3">
                        <div className="font-medium text-foreground">{member.name}</div>
                        <div className="text-xs text-muted-foreground">{member.role}</div>
                      </td>
                      {weekDays.map((day, idx) => {
                        const shifts = getSchedulesForStaffAndDay(member.id, day.getDay(), staffShifts, selectedLocation, locations);
                        const off = hasTimeOffOnDate(member.id, day, exceptions);
                        return (
                          <td key={idx} className="p-1 text-center align-top">
                            <div className="flex flex-col items-center gap-1">
                              {off ? (
                                <Badge
                                  variant="default"
                                  className={`text-xs w-full justify-center ${timeOffTypeColors[off.type] || 'bg-gray-500'} text-white`}
                                >
                                  {off.type.charAt(0).toUpperCase() + off.type.slice(1)}
                                </Badge>
                              ) : (
                                <>
                                  {shifts.map((shift: StaffShift, shiftIdx: number) => (
                                    <div
                                      key={shiftIdx}
                                      onClick={() => handleShiftCellClick(member, day, shift)}
                                      className="bg-primary/10 text-primary px-1 py-0.5 rounded text-xs leading-tight hover:bg-primary/20 transition-colors flex items-center justify-center whitespace-nowrap w-full cursor-pointer"
                                    >
                                      {shift.start_time.substring(0, 5)}-{shift.end_time.substring(0, 5)}
                                      <span className="text-[10px] text-muted-foreground ml-1">
                                        ({getLocationNameById(shift.location_id, locations).substring(0, 3)})
                                      </span>
                                      {shift.id && <Pencil className="w-3 h-3 inline ml-1 opacity-70" />}
                                    </div>
                                  ))}
                                  {member.active && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-full mt-1 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                      onClick={() => handleShiftCellClick(member, day, undefined)}
                                      title="Adicionar novo turno"
                                    >
                                      <Plus className="w-4 h-4 opacity-70" />
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          {scheduleView === "month" && (
            <Card className="p-4">
              <div className="grid grid-cols-7 gap-1">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                  <div key={day} className="text-center text-sm font-semibold text-foreground p-2">{day}</div>
                ))}
                {monthDays.map((day, idx) => {
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isTodayDate = isToday(day);
                  const staffWithShifts = filteredStaff.filter(member => {
                    const shifts = getSchedulesForStaffAndDay(member.id, day.getDay(), staffShifts, selectedLocation, locations);
                    const off = hasTimeOffOnDate(member.id, day, exceptions);
                    return shifts.length > 0 && !off;
                  });
                  const staffOnLeave = filteredStaff.map(member => { const leaveInfo = hasTimeOffOnDate(member.id, day, exceptions); return leaveInfo ? { ...member, leaveInfo } : null; }).filter((item): item is StaffMember & { leaveInfo: StaffException } => !!item);
                  return (
                    <div key={idx} onClick={() => handleMonthDayClick(day)} className={`border rounded p-2 min-h-28 text-xs flex flex-col cursor-pointer transition-colors hover:bg-muted ${isCurrentMonth ? 'bg-background' : 'bg-muted/50'}`}>
                      <div className="font-semibold text-foreground mb-1 flex justify-end"><span className={`w-6 h-6 flex items-center justify-center rounded-full ${isTodayDate ? 'bg-primary text-primary-foreground' : ''}`}>{format(day, "d")}</span></div>
                      <div className="space-y-1 overflow-y-auto">
                        {staffWithShifts.map(s => (<div key={`${s.id}-work`} className="text-xs truncate text-muted-foreground p-1 rounded bg-green-500/10">{s.name}</div>))}
                        {staffOnLeave.map(s => (<Badge key={`${s.id}-leave`} variant="default" className={`w-full justify-start truncate ${timeOffTypeColors[s.leaveInfo.type]} text-white`}>{s.name}</Badge>))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="timeoff" className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Select value={exceptionStatusFilter} onValueChange={setExceptionStatusFilter}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Filtrar Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="aprovado">Aprovados</SelectItem>
                  <SelectItem value="pendente">Pendentes</SelectItem>
                  <SelectItem value="rejeitado">Rejeitados</SelectItem>
                </SelectContent>
              </Select>
              <Select value={currentSelectedLocationValue} onValueChange={handleLocationChange}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_LOCATIONS_VALUE}>Todas</SelectItem>
                  {locations.map(loc => <SelectItem key={loc.id} value={loc.name}>{loc.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <TimeOffModal staff={activeStaff} />
          </div>
          <Card>
            {filteredExceptions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Umbrella className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma folga ou férias cadastrada com os filtros atuais.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Profissional</TableHead><TableHead>Tipo</TableHead><TableHead>Período</TableHead><TableHead>Duração</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExceptions.map(exc => {
                    const startDate = new Date(exc.start_date + 'T12:00:00');
                    const endDate = new Date(exc.end_date + 'T12:00:00');
                    const duration = differenceInDays(endDate, startDate) + 1;
                    const isSingleDay = duration === 1;
                    return (
                      <TableRow key={exc.id}>
                        <TableCell className="font-medium">{getStaffName(exc.staff_id)}</TableCell>
                        <TableCell><Badge className={`${timeOffTypeColors[exc.type]} text-white`}>{exc.type.charAt(0).toUpperCase() + exc.type.slice(1)}</Badge></TableCell>
                        <TableCell>{isSingleDay ? format(startDate, "dd/MM/yyyy") : `${format(startDate, "dd/MM/yy")} - ${format(endDate, "dd/MM/yy")}`}</TableCell>
                        <TableCell>{duration} {duration > 1 ? 'dias' : 'dia'}</TableCell>
                        <TableCell><Badge className={statusColors[exc.status]}>{exc.status.charAt(0).toUpperCase() + exc.status.slice(1)}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {exc.status === 'pendente' ? (
                              <>
                                <Button size="sm" variant="outline" onClick={() => updateExceptionStatus.mutate({ id: exc.id, status: 'aprovado' })} disabled={updateExceptionStatus.isPending} title="Aprovar"><Check className="w-4 h-4 text-green-600" /></Button>
                                <Button size="sm" variant="outline" onClick={() => updateExceptionStatus.mutate({ id: exc.id, status: 'rejeitado' })} disabled={updateExceptionStatus.isPending} title="Recusar"><X className="w-4 h-4 text-red-600" /></Button>
                                <Button size="sm" variant="ghost" onClick={() => deleteException.mutate(exc.id)} disabled={deleteException.isPending} title="Excluir"><Trash2 className="w-4 h-4" /></Button>
                              </>
                            ) : (
                                <>
                                    <Button size="sm" variant="ghost" onClick={() => updateExceptionStatus.mutate({ id: exc.id, status: 'pendente' })} disabled={updateExceptionStatus.isPending} title="Reverter para Pendente"><Pencil className="w-4 h-4" /></Button>
                                    <Button size="sm" variant="ghost" onClick={() => deleteException.mutate(exc.id)} disabled={deleteException.isPending} title="Excluir"><Trash2 className="w-4 h-4" /></Button>
                                </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="commissions" className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Select value={commissionStatusFilter} onValueChange={setCommissionStatusFilter}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="Filtrar Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Status</SelectItem>
                    <SelectItem value="pendente_pagamento">Pendentes</SelectItem>
                    <SelectItem value="pago">Pagos</SelectItem>
                    <SelectItem value="cancelado">Cancelados</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1 border rounded-md p-1">
                    <Button variant="ghost" size="sm" onClick={() => handleCommissionMonthChange('prev')}>&lt;</Button>
                    <span className="text-sm font-medium text-foreground w-24 text-center">{displayCommissionMonth}</span>
                    <Button variant="ghost" size="sm" onClick={() => handleCommissionMonthChange('next')}>&gt;</Button>
                </div>
                <Select value={currentSelectedLocationValue} onValueChange={handleLocationChange}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="Todas Unidades" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_LOCATIONS_VALUE}>Todas</SelectItem>
                    {locations.map(loc => <SelectItem key={loc.id} value={loc.name}>{loc.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <CommissionModal staff={activeStaff} services={services} />
            </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/10 rounded-lg"><DollarSign className="w-6 h-6 text-amber-500" /></div>
                <div><p className="text-sm text-muted-foreground">Total em Comissões (Filtrado)</p><p className="text-2xl font-bold text-foreground">R$ {totalCommissionAmount.toFixed(2)}</p></div>
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 rounded-lg"><Calendar className="w-6 h-6 text-blue-500" /></div>
                <div><p className="text-sm text-muted-foreground">Total de Atendimentos (Filtrado)</p><p className="text-2xl font-bold text-foreground">{totalAppointments}</p></div>
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-500/10 rounded-lg"><DollarSign className="w-6 h-6 text-green-500" /></div>
                <div><p className="text-sm text-muted-foreground">Média por Profissional</p><p className="text-2xl font-bold text-foreground">R$ {(totalCommissionAmount / filteredStaff.length || 0).toFixed(2)}</p></div>
              </div>
            </Card>
          </div>
          <Card>
              <div className="space-y-2">
                {Object.keys(commissionsByStaff).length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma comissão encontrada para os filtros aplicados.</p>
                  </div>
                ) : (
                  <Accordion type="single" collapsible className="w-full">
                    {Object.keys(commissionsByStaff).map(staffId => {
                      const staffCommissions = commissionsByStaff[staffId];
                      const totalAmount = staffCommissions.reduce((sum, c) => sum + c.commission_amount_centavos, 0);
                      const pendingAmount = staffCommissions.filter(c => c.status === 'pendente_pagamento').reduce((sum, c) => sum + c.commission_amount_centavos, 0);
                      return (
                        <AccordionItem value={staffId} key={staffId}>
                          <AccordionTrigger className="px-6 hover:bg-muted/50">
                            <div className="flex justify-between w-full pr-4">
                              <h3 className="font-semibold text-foreground text-left">{getStaffName(staffId)}</h3>
                              <div className="flex gap-4 text-sm text-right"><span><span className="text-muted-foreground">Atendimentos: </span>{staffCommissions.length}</span><span className="text-amber-600"><span className="text-muted-foreground">Pendente: </span>R$ {(pendingAmount / 100).toFixed(2)}</span><span className="font-bold text-green-600"><span className="text-muted-foreground font-normal">Total: </span>R$ {(totalAmount / 100).toFixed(2)}</span></div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-2 pb-2">
                            <div className="space-y-2 p-4 border-t">
                              {staffCommissions.map(com => {
                                const serviceDate = new Date(`${com.date}T00:00:00`);
                                const paymentDate = com.payment_date ? new Date(`${com.payment_date}T00:00:00`) : null;
                                return (
                                  <div key={com.id} className="flex items-center justify-between p-3 border rounded hover:bg-muted/50">
                                    <div className="flex-1"><div className="flex items-center gap-3"><h3 className="font-semibold text-foreground">{getStaffName(com.staff_id)}</h3><Badge className={statusColors[com.status]}>{com.status === 'pendente_pagamento' ? 'Pendente' : com.status}</Badge></div><p className="text-sm text-muted-foreground mt-1">Serviço: {com.service_name || 'Desconhecido'} | Data: {format(serviceDate, 'dd/MM/yyyy')}{com.status === 'pago' && paymentDate && (<span className="text-xs italic text-green-600 ml-2">(Pago em: {format(paymentDate, 'dd/MM/yyyy')})</span>)}</p></div>
                                    <div className="text-right"><p className="text-lg font-bold text-foreground">R$ {(com.commission_amount_centavos / 100).toFixed(2)}</p><p className="text-xs text-muted-foreground">{com.commission_percentage}% do serviço</p></div>
                                    <div className="flex items-center gap-2 ml-4">
                                      {com.status === 'pendente_pagamento' ? (<Button size="sm" onClick={() => updateCommissionStatus.mutate({ id: com.id, status: 'pago', payment_date: format(new Date(), 'yyyy-MM-dd') })} disabled={updateCommissionStatus.isPending}>Pagar <Check className="w-4 h-4 ml-1" /></Button>) : (<Button size="sm" variant="outline" onClick={() => updateCommissionStatus.mutate({ id: com.id, status: 'pendente_pagamento' })} disabled={updateCommissionStatus.isPending} title="Reverter para Pendente">Reverter</Button>)}
                                      {com.status !== 'cancelado' && (<Button size="sm" variant="ghost" onClick={() => updateCommissionStatus.mutate({ id: com.id, status: 'cancelado' })} disabled={updateCommissionStatus.isPending} title="Cancelar Comissão"><X className="w-4 h-4" /></Button>)}
                                      <Button size="sm" variant="ghost" onClick={() => deleteCommission.mutate(com.id)} disabled={deleteCommission.isPending} title="Excluir"><Trash2 className="w-4 h-4" /></Button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )
                    })}
                  </Accordion>
                )}
              </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
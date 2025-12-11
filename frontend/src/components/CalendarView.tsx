import { useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge"; // Voltei com o Badge
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths, 
  startOfWeek, 
  endOfWeek,
  isToday
} from "date-fns";
import { ptBR } from "date-fns/locale";

interface Appointment {
  id: string;
  customerName: string;
  serviceName: string;
  staffName: string;
  startTime: Date;
  endTime: Date;
  status: "confirmed" | "completed" | "cancelled" | "pending";
}

interface CalendarViewProps {
  appointments: Appointment[];
  onAppointmentClick?: (appointment: Appointment) => void;
  onDateClick?: (date: Date) => void;
}

// 🎨 CORES ORIGINAIS (Restauradas)
// Usando as variáveis do seu tema (bg-chart-X)
const statusConfig: Record<string, string> = {
  confirmed: "bg-chart-3",      // Geralmente Verde ou Azul
  completed: "bg-chart-1",      // Geralmente Sucesso/Verde
  cancelled: "bg-destructive",  // Vermelho
  pending: "bg-chart-2",        // Geralmente Amarelo/Laranja
};

export default function CalendarView({ appointments, onAppointmentClick, onDateClick }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { locale: ptBR });
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];

  // Filtra agendamentos do dia selecionado (para a lista mobile)
  const selectedDayAppointments = appointments
    .filter(app => isSameDay(app.startTime, selectedDay))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  return (
    <div className="flex flex-col h-full space-y-4 w-full">
      
      {/* --- BLOCO 1: O CALENDÁRIO --- */}
      <Card className="p-2 md:p-4 border-border shadow-sm bg-card w-full">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-sm md:text-lg font-bold text-foreground capitalize flex items-center gap-2">
            {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
          </h2>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="h-7 w-7 md:h-8 md:w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="h-7 w-7 md:h-8 md:w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Grade de Dias (Responsiva) */}
        <div className="w-full">
          {/* Cabeçalho da Semana */}
          <div className="grid grid-cols-7 mb-1">
            {weekDays.map((day, i) => (
              <div key={i} className="text-center text-[10px] md:text-xs font-semibold text-muted-foreground uppercase py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Dias */}
          <div className="grid grid-cols-7 gap-px bg-muted border border-border rounded-lg overflow-hidden w-full">
            {days.map((day) => {
              const dayApps = appointments.filter(app => isSameDay(app.startTime, day));
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = isSameDay(day, selectedDay);
              const isTodayDate = isToday(day);

              return (
                <div
                  key={day.toString()}
                  onClick={() => {
                    setSelectedDay(day);
                    if (onDateClick) onDateClick(day);
                  }}
                  className={`
                    relative flex flex-col items-center md:items-stretch
                    min-h-[45px] md:min-h-[110px] p-0.5 md:p-1 cursor-pointer transition-all
                    ${!isCurrentMonth ? "bg-muted/50 text-muted-foreground/50" : "bg-card text-foreground"}
                    hover:bg-accent hover:text-accent-foreground
                  `}
                >
                  {/* Número do Dia (Bolinha no Mobile se selecionado) */}
                  <div className={`
                      w-6 h-6 md:w-auto md:h-auto flex items-center justify-center rounded-full text-xs md:text-sm font-medium mb-0.5
                      md:justify-between md:items-start md:rounded-none md:mb-0
                      ${isSelected ? "bg-primary text-primary-foreground md:bg-transparent md:text-foreground" : ""}
                      ${isTodayDate && !isSelected ? "text-primary font-bold" : ""}
                  `}>
                    <span>{format(day, "d")}</span>
                    
                    {/* Contador (SÓ DESKTOP) */}
                    {dayApps.length > 0 && (
                      <span className="hidden md:block text-[10px] text-muted-foreground font-medium">
                        {dayApps.length}
                      </span>
                    )}
                  </div>

                  {/* 📱 MOBILE: Pontinhos coloridos (Estilo iPhone) */}
                  <div className="md:hidden flex gap-0.5 justify-center mt-0.5 h-1.5">
                    {dayApps.slice(0, 3).map((apt, idx) => (
                      <div 
                        key={idx} 
                        className={`w-1 h-1 rounded-full ${statusConfig[apt.status] || "bg-muted-foreground"}`} 
                      />
                    ))}
                    {dayApps.length > 3 && (
                       <div className="w-1 h-1 rounded-full bg-muted-foreground opacity-50"></div>
                    )}
                  </div>

                  {/* 💻 DESKTOP: Barras de Texto */}
                  <div className="hidden md:flex flex-col gap-1 mt-1">
                    {dayApps.slice(0, 3).map((apt) => (
                      <div
                        key={apt.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAppointmentClick?.(apt);
                        }}
                        className={`
                          text-[10px] px-1.5 py-0.5 rounded truncate cursor-pointer opacity-90 hover:opacity-100 hover:shadow-sm transition-all text-white
                          ${statusConfig[apt.status] || "bg-muted-foreground"}
                        `}
                        title={`${format(apt.startTime, "HH:mm")} - ${apt.customerName}`}
                      >
                        <span className="font-bold mr-1 opacity-75">{format(apt.startTime, "HH:mm")}</span>
                        {apt.customerName.split(' ')[0]}
                      </div>
                    ))}
                    {dayApps.length > 3 && (
                      <div className="text-[9px] text-muted-foreground pl-1">
                        +{dayApps.length - 3} mais
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        </div>

        {/* LEGENDA (Restaurada com Badge e Cores Originais) */}
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-4 pt-3 border-t border-border">
          <Badge className="bg-chart-3 hover:bg-chart-3/90 text-white font-normal text-[10px] h-5">Confirmado</Badge>
          <Badge className="bg-chart-1 hover:bg-chart-1/90 text-white font-normal text-[10px] h-5">Concluído</Badge>
          <Badge className="bg-chart-2 hover:bg-chart-2/90 text-white font-normal text-[10px] h-5">Pendente</Badge>
          <Badge className="bg-destructive hover:bg-destructive/90 text-white font-normal text-[10px] h-5">Cancelado</Badge>
        </div>
      </Card>

      {/* --- BLOCO 2: LISTA DE AGENDAMENTOS (SÓ MOBILE - Estilo iPhone) --- */}
      <div className="md:hidden flex-1 animate-in slide-in-from-bottom-4 duration-500 pb-20">
        <div className="bg-muted/30 rounded-lg p-3 min-h-[150px]">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
            {isToday(selectedDay) ? "Hoje" : format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </h3>

          {selectedDayAppointments.length > 0 ? (
            <div className="space-y-2">
              {selectedDayAppointments.map((app) => (
                <div 
                  key={app.id}
                  onClick={() => onAppointmentClick?.(app)}
                  className="bg-card p-3 rounded-xl shadow-sm border border-border flex gap-3 items-center active:scale-[0.98] transition-transform"
                >
                  {/* Faixa lateral colorida indicando status */}
                  <div className={`w-1 h-8 rounded-full ${statusConfig[app.status]}`}></div>

                  <div className="flex flex-col items-center justify-center px-1 border-r border-border pr-3 min-w-[50px]">
                    <span className="text-xs font-bold text-foreground">{format(app.startTime, "HH:mm")}</span>
                    <span className="text-[10px] text-muted-foreground">{format(app.endTime, "HH:mm")}</span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-foreground text-sm truncate">{app.serviceName}</h4>
                    <p className="text-xs text-muted-foreground truncate">{app.customerName}</p>
                  </div>

                  <div className="text-muted-foreground">
                    <CalendarIcon className="w-4 h-4 opacity-50" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-24 text-muted-foreground/50">
              <Clock className="w-6 h-6 mb-2" />
              <p className="text-xs">Sem agendamentos</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
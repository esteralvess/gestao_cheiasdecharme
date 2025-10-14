import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
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

const statusConfig = {
  confirmed: "bg-chart-3",
  completed: "bg-chart-1",
  cancelled: "bg-destructive",
  pending: "bg-chart-2",
};

export default function CalendarView({ appointments, onAppointmentClick, onDateClick }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { locale: ptBR });
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getAppointmentsForDay = (day: Date) => {
    return appointments.filter(apt => isSameDay(new Date(apt.startTime), day));
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-foreground">
          {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePreviousMonth}
            data-testid="button-previous-month"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleNextMonth}
            data-testid="button-next-month"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
          <div key={day} className="text-center text-sm font-semibold text-muted-foreground py-2">
            {day}
          </div>
        ))}

        {days.map((day, idx) => {
          const dayAppointments = getAppointmentsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={idx}
              className={`min-h-24 p-2 border rounded-lg cursor-pointer hover-elevate transition-colors ${
                isCurrentMonth ? "bg-card" : "bg-muted/30"
              } ${isToday ? "border-primary border-2" : "border-border"}`}
              onClick={() => onDateClick?.(day)}
              data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
            >
              <div className={`text-sm font-medium mb-1 ${
                isCurrentMonth ? "text-foreground" : "text-muted-foreground"
              } ${isToday ? "text-primary" : ""}`}>
                {format(day, "d")}
              </div>
              <div className="space-y-1">
                {dayAppointments.slice(0, 2).map((apt) => (
                  <div
                    key={apt.id}
                    className={`text-xs px-1 py-0.5 rounded truncate ${statusConfig[apt.status]} text-white cursor-pointer`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAppointmentClick?.(apt);
                    }}
                    title={`${format(new Date(apt.startTime), "HH:mm")} - ${apt.customerName}`}
                  >
                    {format(new Date(apt.startTime), "HH:mm")} {apt.customerName}
                  </div>
                ))}
                {dayAppointments.length > 2 && (
                  <div className="text-xs text-muted-foreground px-1">
                    +{dayAppointments.length - 2} mais
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-6 pt-4 border-t">
        <div className="flex items-center gap-2">
          <Badge className="bg-chart-3 text-white no-default-hover-elevate no-default-active-elevate">
            Confirmado
          </Badge>
          <Badge className="bg-chart-1 text-white no-default-hover-elevate no-default-active-elevate">
            Concluído
          </Badge>
          <Badge className="bg-chart-2 text-white no-default-hover-elevate no-default-active-elevate">
            Pendente
          </Badge>
          <Badge className="bg-destructive text-white no-default-hover-elevate no-default-active-elevate">
            Cancelado
          </Badge>
        </div>
      </div>
    </Card>
  );
}

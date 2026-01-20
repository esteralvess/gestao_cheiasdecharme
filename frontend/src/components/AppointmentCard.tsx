import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, User, Scissors, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default function AppointmentCard({ id, customerName, serviceName, staffName, startTime, endTime, status, locationName, onClick }: any) {
  
  // Tratamento robusto de data
  let start = null;
  let end = null;

  try {
      start = startTime instanceof Date ? startTime : (startTime ? parseISO(startTime) : null);
      end = endTime instanceof Date ? endTime : (endTime ? parseISO(endTime) : null);
  } catch (e) {
      console.error("Data inválida no card:", startTime);
  }

  const isValidDate = start && isValid(start) && end && isValid(end);

  const statusColors: any = {
    confirmed: "bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200",
    completed: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200",
    cancelled: "bg-red-100 text-red-700 hover:bg-red-200 border-red-200",
    pending: "bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200",
  };

  const statusLabel: any = {
    confirmed: "Confirmado",
    completed: "Concluído",
    cancelled: "Cancelado",
    pending: "Pendente",
  };

  return (
    <Card 
      className="p-4 flex flex-col gap-3 hover:shadow-md transition-all cursor-pointer border-l-4 border-l-[#C6A87C] bg-white group active:scale-[0.99]"
      onClick={onClick}
    >
      {/* LINHA 1: Cliente e Status */}
      <div className="flex justify-between items-start gap-2">
        <div className="flex flex-col min-w-0">
          <h4 className="font-bold text-stone-800 text-base leading-tight truncate group-hover:text-[#C6A87C] transition-colors">
            {customerName || "Cliente sem nome"}
          </h4>
          <span className="text-xs text-stone-500 font-medium flex items-center gap-1 mt-1 truncate">
            <Scissors className="w-3 h-3 shrink-0" /> 
            <span className="truncate">{serviceName || "Serviço não informado"}</span>
          </span>
        </div>
        <Badge variant="outline" className={`text-[10px] uppercase font-bold border shrink-0 ${statusColors[status] || "bg-gray-100 text-gray-600"}`}>
          {statusLabel[status] || status}
        </Badge>
      </div>

      {/* LINHA 2: Rodapé (Data, Profissional, Local) */}
      {/* 🔥 Alteração aqui: flex-wrap para permitir quebra de linha em telas pequenas */}
      <div className="flex flex-wrap items-center gap-y-2 gap-x-3 text-xs text-stone-500 pt-2 border-t border-stone-100 mt-1">
        
        {/* Bloco de Horário */}
        <div className="flex items-center gap-1 bg-stone-50 px-2 py-1 rounded-md shrink-0">
            <Clock className="w-3 h-3 text-[#C6A87C]" />
            {isValidDate ? (
                <span className="font-semibold text-stone-700 whitespace-nowrap">
                    {format(start!, "HH:mm")} - {format(end!, "HH:mm")}
                </span>
            ) : (
                <span className="text-red-400">Horário Inválido</span>
            )}
        </div>

        {/* Bloco de Profissional */}
        <div className="flex items-center gap-1 min-w-0 max-w-[120px]">
            <User className="w-3 h-3 shrink-0" /> 
            <span className="truncate">{staffName}</span>
        </div>

        {/* Bloco de Localização (Empurrado para a direita se houver espaço, ou quebra linha) */}
        {locationName && (
            <div className="flex items-center gap-1 text-[10px] opacity-70 ml-auto pl-1 border-l border-stone-200">
                <MapPin className="w-3 h-3 shrink-0" /> 
                <span className="truncate max-w-[100px]">{locationName}</span>
            </div>
        )}
      </div>
    </Card>
  );
}
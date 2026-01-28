import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { expensesAPI, creditCardsAPI } from "@/services/api";
import { CreditCardManager } from "@/components/finance/CreditCardManager";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { CreditCard as CardIcon } from "lucide-react";

export default function CardsPage() {
  const queryClient = useQueryClient();
  
  // Queries
  const { data: expenses = [], isLoading: loadExp } = useQuery({ queryKey: ['expenses'], queryFn: expensesAPI.getAll });
  const { data: creditCards = [], isLoading: loadCards } = useQuery({ queryKey: ['creditCards'], queryFn: creditCardsAPI.getAll });

  const isLoading = loadExp || loadCards;

  // Mutations
  const saveCardMutation = useMutation({ 
      mutationFn: (data: any) => { 
          const { id, ...payload } = data; 
          return id ? creditCardsAPI.update(id, payload) : creditCardsAPI.create(payload) 
      }, 
      onSuccess: () => { 
          toast.success("Cartão salvo!"); 
          queryClient.invalidateQueries({ queryKey: ['creditCards'] }); 
      },
      onError: () => toast.error("Erro ao salvar cartão.")
  });

  if (isLoading) return <div className="p-8"><Skeleton className="h-64 w-full rounded-2xl"/></div>;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 bg-[#FAFAF9] min-h-screen">
      <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-xl border border-stone-200 shadow-sm">
              <CardIcon className="w-6 h-6 text-[#C6A87C]" />
          </div>
          <div>
              <h1 className="text-2xl font-bold text-stone-800">Meus Cartões</h1>
              <p className="text-stone-500 text-sm">Gerencie limites e acompanhe faturas.</p>
          </div>
      </div>

      <CreditCardManager 
        cards={creditCards} 
        expenses={expenses} 
        onSaveCard={saveCardMutation.mutate} 
      />
    </div>
  );
}
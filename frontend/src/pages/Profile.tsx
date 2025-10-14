// src/pages/Profile.tsx

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { userAPI } from "@/services/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const profileSchema = z.object({
  first_name: z.string().min(1, "O nome é obrigatório."),
  last_name: z.string().min(1, "O sobrenome é obrigatório."),
  email: z.string().email("Por favor, insira um e-mail válido."),
});

export default function Profile() {
  const queryClient = useQueryClient();

  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: userAPI.getMe,
  });

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    values: { // 'values' em vez de 'defaultValues' para preencher com dados da API
      first_name: user?.first_name || "",
      last_name: user?.last_name || "",
      email: user?.email || "",
    },
    // Re-valida quando os dados do 'user' chegam da API
    reValidateMode: "onChange",
  });

  const updateMutation = useMutation({
    mutationFn: userAPI.updateMe,
    onSuccess: (updatedUser) => {
      toast.success("Perfil atualizado com sucesso!");
      // Atualiza os dados em cache do usuário com a nova informação
      queryClient.setQueryData(['currentUser'], updatedUser);
    },
    onError: () => {
      toast.error("Ocorreu um erro ao atualizar o perfil.");
    },
  });

  const onSubmit = (values: z.infer<typeof profileSchema>) => {
    updateMutation.mutate(values);
  };

  if (isLoadingUser) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-1/4 mb-4" />
        <Skeleton className="h-64 w-full max-w-2xl" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-semibold text-foreground mb-6">Minha Conta</h1>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Detalhes do Perfil</CardTitle>
          <CardDescription>Atualize seu nome e e-mail.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="first_name" render={({ field }) => (
                  <FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="last_name" render={({ field }) => (
                  <FormItem><FormLabel>Sobrenome</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>E-mail</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
               <FormItem>
                 <FormLabel>Nome de Usuário</FormLabel>
                 <FormControl><Input disabled value={user?.username || ''} /></FormControl>
               </FormItem>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
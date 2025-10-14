// src/pages/management/UserEditModal.tsx

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

// Tipos de dados que o modal espera receber
interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  groups: number[];
}
interface Group {
  id: number;
  name: string;
}
interface UserEditModalProps {
  user: User | null;
  groups: Group[];
  onClose: () => void;
  onSave: (data: Partial<User>) => void;
  isSaving: boolean;
}

// Schema de validação para o formulário
const userSchema = z.object({
  first_name: z.string().min(1, "O nome é obrigatório."),
  last_name: z.string().min(1, "O sobrenome é obrigatório."),
  email: z.string().email("E-mail inválido."),
  groups: z.array(z.number()).optional(),
});

export function UserEditModal({ user, groups, onClose, onSave, isSaving }: UserEditModalProps) {
  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      groups: [],
    },
  });

  // Preenche o formulário quando um usuário é selecionado para edição
  useEffect(() => {
    if (user) {
      form.reset({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
        groups: user.groups || [],
      });
    }
  }, [user, form]);

  const onSubmit = (values: z.infer<typeof userSchema>) => {
    if (!user) return;
    onSave({ id: user.id, ...values });
  };

  if (!user) return null;

  return (
    <Dialog open={!!user} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Usuário: {user.first_name}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
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
            
            <FormField
              control={form.control}
              name="groups"
              render={() => (
                <FormItem>
                  <FormLabel>Grupos de Permissão</FormLabel>
                  <div className="space-y-2 rounded-md border p-4">
                    {groups.map((group) => (
                      <FormField
                        key={group.id}
                        control={form.control}
                        name="groups"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(group.id)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...(field.value || []), group.id])
                                    : field.onChange(field.value?.filter((value) => value !== group.id));
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">{group.name}</FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                   <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
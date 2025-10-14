import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminAPI } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserEditModal } from "./management/UserEditModal"; // ✅ Importa o novo modal

// Tipos de dados para a página
interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  groups: number[];
  is_active: boolean;
}
interface Group {
  id: number;
  name: string;
}

export default function Management() {
    const queryClient = useQueryClient();
    const [editingUser, setEditingUser] = useState<User | null>(null);

    const { data: users, isLoading: isLoadingUsers } = useQuery<User[]>({
        queryKey: ['admin_users'],
        queryFn: adminAPI.getUsers,
    });

    const { data: groups = [], isLoading: isLoadingGroups } = useQuery<Group[]>({
        queryKey: ['admin_groups'],
        queryFn: adminAPI.getGroups,
    });

    // ✅ Mutation para atualizar os dados do usuário
    const updateUserMutation = useMutation({
        mutationFn: (userData: Partial<User>) => {
            if (!userData.id) throw new Error("ID do usuário é necessário para atualizar.");
            return adminAPI.updateUser(userData.id, userData);
        },
        onSuccess: () => {
            toast.success("Usuário atualizado com sucesso!");
            queryClient.invalidateQueries({ queryKey: ['admin_users'] });
            setEditingUser(null); // Fecha o modal
        },
        onError: () => {
            toast.error("Falha ao atualizar o usuário.");
        }
    });

    const getGroupName = (groupId: number) => {
        return groups?.find(g => g.id === groupId)?.name || 'N/A';
    }

    const isLoading = isLoadingUsers || isLoadingGroups;

    return (
        <div className="p-6 space-y-6">
            {/* ✅ Adiciona o modal à página */}
            <UserEditModal 
                user={editingUser}
                groups={groups}
                onClose={() => setEditingUser(null)}
                onSave={updateUserMutation.mutate}
                isSaving={updateUserMutation.isPending}
            />

            <div>
                <h1 className="text-3xl font-semibold text-foreground mb-2">Gestão de Usuários</h1>
                <p className="text-muted-foreground">Adicione e gerencie os acessos da sua equipe.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Usuários do Sistema</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader><TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Usuário</TableHead>
                                <TableHead>Grupos</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                                {users?.map(user => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">{user.first_name} {user.last_name}</TableCell>
                                        <TableCell>{user.username}</TableCell>
                                        <TableCell className="space-x-1">
                                            {user.groups.map((groupId: number) => (
                                                <Badge key={groupId} variant="secondary">{getGroupName(groupId)}</Badge>
                                            ))}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={user.is_active ? "default" : "destructive"}>
                                                {user.is_active ? "Ativo" : "Inativo"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {/* ✅ O botão agora abre o modal */}
                                            <Button variant="outline" size="sm" onClick={() => setEditingUser(user)}>
                                                Editar
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
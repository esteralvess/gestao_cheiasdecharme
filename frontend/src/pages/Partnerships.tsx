import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
    Building2, Plus, Copy, MoreHorizontal, Trash2, Link as LinkIcon, Percent, Users 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { partnersAPI } from "@/services/api";

export default function Partnerships() {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ name: "", slug: "", discount_percent: "10" });

    // Busca parceiros
    const { data: partners = [], isLoading } = useQuery({ 
        queryKey: ['partners'], 
        queryFn: partnersAPI.getAll 
    });

    // Cria parceiro
    const createMutation = useMutation({
        mutationFn: partnersAPI.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['partners'] });
            setIsModalOpen(false);
            toast.success("Parceria criada com sucesso!");
            setFormData({ name: "", slug: "", discount_percent: "10" }); // Limpa form
        },
        onError: () => toast.error("Erro ao criar. Verifique se o nome já existe.")
    });

    // Deleta parceiro
    const deleteMutation = useMutation({
        mutationFn: partnersAPI.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['partners'] });
            toast.success("Parceria removida.");
        }
    });

    const handleDelete = (id: string) => {
        if(confirm("Deseja remover esta parceria? O link deixará de funcionar.")) {
            deleteMutation.mutate(id);
        }
    };

    const generateSlug = (name: string) => {
        return name.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
            .replace(/ /g, '-')
            .replace(/[^\w-]+/g, ''); // Remove caracteres especiais
    };

    const copyLink = (slug: string) => {
        const link = `${window.location.origin}/agendamento-online?parceria=${slug}`;
        
        navigator.clipboard.writeText(link);
        toast.success("Link público copiado!"); 
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 min-h-screen bg-[#FDFDFD]">
            
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-in slide-in-from-top-4">
                <div>
                    <h1 className="text-3xl font-black text-stone-800 flex items-center gap-3">
                        <Building2 className="w-8 h-8 text-[#C6A87C]" /> Parcerias Corporativas
                    </h1>
                    <p className="text-stone-500 mt-1">Gerencie descontos exclusivos para empresas parceiras.</p>
                </div>
                <Button 
                    onClick={() => { setFormData({name: "", slug: "", discount_percent: "10"}); setIsModalOpen(true); }} 
                    className="bg-[#C6A87C] hover:bg-[#B08D55] text-white font-bold h-12 px-6 rounded-xl shadow-lg transition-all"
                >
                    <Plus className="w-5 h-5 mr-2"/> Nova Parceria
                </Button>
            </div>

            {/* LISTA DE PARCEIROS (GRID) */}
            {isLoading ? (
                <div className="text-center py-20 text-stone-400">Carregando parceiros...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
                    {partners.map((partner: any) => (
                        <div key={partner.id} className="group relative bg-white rounded-3xl p-6 border border-stone-100 shadow-sm hover:shadow-xl hover:border-[#C6A87C]/30 transition-all duration-300">
                            
                            {/* Card Header */}
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-stone-50 border border-stone-100 flex items-center justify-center text-stone-700 font-bold text-xl uppercase select-none">
                                    {partner.name.substring(0,2)}
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-stone-300 hover:text-stone-600">
                                            <MoreHorizontal className="w-4 h-4"/>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="rounded-xl">
                                        <DropdownMenuItem className="text-red-500 cursor-pointer" onClick={() => handleDelete(partner.id)}>
                                            <Trash2 className="w-3 h-3 mr-2"/> Encerrar Parceria
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {/* Info */}
                            <h3 className="text-xl font-bold text-stone-800 mb-1 truncate" title={partner.name}>{partner.name}</h3>
                            <div className="flex items-center gap-2 mb-6">
                                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-100">
                                    <Percent className="w-3 h-3 mr-1"/> {partner.discount_percent}% OFF
                                </Badge>
                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Serviços Avulsos</span>
                            </div>

                            {/* Link Box */}
                            <div className="p-4 bg-stone-50 rounded-xl border border-stone-100 group-hover:bg-[#C6A87C]/5 group-hover:border-[#C6A87C]/20 transition-colors">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-stone-400 uppercase flex items-center gap-1">
                                        <LinkIcon className="w-3 h-3"/> Link de Agendamento
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1 bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs text-stone-500 truncate font-mono select-all">
                                        {window.location.origin}/appointments?parceria={partner.slug}
                                    </div>
                                    <Button size="icon" onClick={() => copyLink(partner.slug)} className="h-9 w-9 bg-white border border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-[#C6A87C] shadow-sm rounded-lg shrink-0">
                                        <Copy className="w-4 h-4"/>
                                    </Button>
                                </div>
                            </div>

                        </div>
                    ))}
                    
                    {/* EMPTY STATE */}
                    {partners.length === 0 && (
                        <div onClick={() => setIsModalOpen(true)} className="border-2 border-dashed border-stone-200 rounded-3xl p-6 flex flex-col items-center justify-center text-stone-400 cursor-pointer hover:border-[#C6A87C] hover:text-[#C6A87C] transition-colors min-h-[200px]">
                            <Users className="w-8 h-8 mb-2 opacity-50"/>
                            <span className="font-bold">Cadastrar Primeira Empresa</span>
                        </div>
                    )}
                </div>
            )}

            {/* MODAL NOVA PARCERIA */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="bg-white rounded-3xl sm:max-w-[400px]">
                    <DialogHeader>
                        <div className="w-12 h-12 rounded-full bg-[#C6A87C]/10 flex items-center justify-center mx-auto mb-2 text-[#C6A87C]">
                            <Building2 className="w-6 h-6"/>
                        </div>
                        <DialogTitle className="text-center font-bold text-xl">Nova Parceria</DialogTitle>
                    </DialogHeader>
                    
                    <div className="py-4 space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-stone-500 uppercase">Nome da Empresa</Label>
                            <Input 
                                placeholder="Ex: Grupo Colinas" 
                                value={formData.name} 
                                onChange={e => {
                                    const name = e.target.value;
                                    setFormData({...formData, name, slug: generateSlug(name)});
                                }}
                                className="rounded-xl border-stone-200"
                            />
                        </div>
                        
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-stone-500 uppercase">Código do Link (Slug)</Label>
                            <Input 
                                value={formData.slug} 
                                disabled 
                                className="bg-stone-50 rounded-xl font-mono text-stone-500 border-stone-200"
                            />
                        </div>
                        
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-stone-500 uppercase">Desconto (%)</Label>
                            <div className="relative">
                                <Input 
                                    type="number" 
                                    value={formData.discount_percent} 
                                    onChange={e => setFormData({...formData, discount_percent: e.target.value})} 
                                    className="rounded-xl border-stone-200 pl-4"
                                />
                                <Percent className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"/>
                            </div>
                            <p className="text-[10px] text-stone-400">Aplicado automaticamente em serviços avulsos.</p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button 
                            onClick={() => createMutation.mutate(formData)} 
                            disabled={createMutation.isPending || !formData.name} 
                            className="w-full bg-[#C6A87C] hover:bg-[#B08D55] text-white font-bold rounded-xl h-11"
                        >
                            {createMutation.isPending ? "Criando..." : "Criar Parceria"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
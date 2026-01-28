import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Plus, ArrowUpCircle, ArrowDownCircle, Tag, AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

export function CategoryManager({ open, onClose, categories, onSave, onDelete }: any) {
    const [newCategory, setNewCategory] = useState("");
    const [activeType, setActiveType] = useState<"expense" | "income">("expense");
    
    // Estado para controlar qual categoria está sendo excluída
    const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

    const handleAdd = () => {
        if (!newCategory.trim()) {
            toast.warning("Digite o nome da categoria!");
            return;
        }
        onSave({ name: newCategory, type: activeType });
        setNewCategory("");
        // O toast de sucesso virá da mutação no arquivo pai, mas podemos forçar um aqui se quiser feedback instantâneo
        // toast.success("Categoria adicionada!"); 
    };

    const confirmDelete = () => {
        if (categoryToDelete) {
            onDelete(categoryToDelete);
            setCategoryToDelete(null);
            // toast.success("Categoria removida!"); // O pai já dispara o toast
        }
    };

    const currentList = categories.filter((c: any) => c.type === activeType);

    return (
        <>
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-[450px] bg-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-stone-800">
                            <Tag className="w-5 h-5 text-[#C6A87C]" /> Gerenciar Categorias
                        </DialogTitle>
                        <DialogDescription>Cadastre opções para organizar seu financeiro.</DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="expense" value={activeType} onValueChange={(v) => setActiveType(v as any)} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-4 bg-stone-100 p-1">
                            <TabsTrigger value="expense" className="data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm text-stone-500">
                                <ArrowDownCircle className="w-4 h-4 mr-2"/> Despesas
                            </TabsTrigger>
                            <TabsTrigger value="income" className="data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm text-stone-500">
                                <ArrowUpCircle className="w-4 h-4 mr-2"/> Receitas
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex gap-2 mb-4">
                            <Input 
                                placeholder={activeType === 'expense' ? "Nova despesa (ex: Aluguel)" : "Nova receita (ex: Produtos)"}
                                value={newCategory}
                                onChange={(e) => setNewCategory(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                                className="bg-stone-50 border-stone-200"
                            />
                            <Button onClick={handleAdd} size="icon" className={activeType === 'expense' ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600"}>
                                <Plus className="w-4 h-4 text-white"/>
                            </Button>
                        </div>

                        <ScrollArea className="h-[250px] pr-3">
                            <div className="space-y-2">
                                {currentList.map((cat: any) => (
                                    <div key={cat.id} className="flex items-center justify-between p-2.5 bg-stone-50 rounded-lg border border-stone-100 group hover:border-stone-300 transition-all">
                                        <span className="font-medium text-stone-700 text-sm">{cat.name}</span>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => setCategoryToDelete(cat.id)} // Abre a confirmação
                                            className="h-7 w-7 text-stone-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 className="w-3.5 h-3.5"/>
                                        </Button>
                                    </div>
                                ))}
                                {currentList.length === 0 && <p className="text-center text-xs text-stone-400 py-8 italic">Nenhuma categoria cadastrada.</p>}
                            </div>
                        </ScrollArea>
                    </Tabs>
                </DialogContent>
            </Dialog>

            {/* 🔥 MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (ANINHADO) */}
            <Dialog open={!!categoryToDelete} onOpenChange={() => setCategoryToDelete(null)}>
                <DialogContent className="sm:max-w-[300px] bg-white">
                    <DialogHeader>
                        <div className="mx-auto w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-2">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                        <DialogTitle className="text-center">Excluir categoria?</DialogTitle>
                        <DialogDescription className="text-center">
                            Essa ação não pode ser desfeita.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2 sm:justify-center">
                        <Button variant="outline" onClick={() => setCategoryToDelete(null)} className="h-9">Cancelar</Button>
                        <Button variant="destructive" onClick={confirmDelete} className="h-9 bg-red-600 hover:bg-red-700">Excluir</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
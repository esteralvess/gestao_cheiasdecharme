import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { authAPI } from "@/services/api"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Schema de validação
const formSchema = z.object({
  username: z.string().min(1, { message: "O usuário é obrigatório." }),
  password: z.string().min(1, { message: "A senha é obrigatória." }),
  rememberMe: z.boolean().default(false).optional(),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
      rememberMe: false,
    },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setServerError("");
    try {
      // 1. Tenta fazer login
      await authAPI.login(values);
      
      // 2. Feedback de sucesso
      toast.success("Bem-vindo(a) de volta!");
      
      // 3. Redireciona para o Dashboard (Gestão)
      // Pequeno delay para garantir a gravação do token
      setTimeout(() => {
        setLocation("/dashboard"); 
      }, 100);

    } catch (error: any) {
      console.error("Erro no login:", error);
      const msg = error.response?.data?.detail || "Usuário ou senha incorretos.";
      setServerError(msg);
      toast.error("Falha ao entrar");
    }
  }

  return (
    // Fundo bege suave igual ao do agendamento
    <div className="min-h-screen w-full flex items-center justify-center bg-[#FDFCF8] p-4 font-sans">
      <Card className="w-full max-w-[400px] shadow-xl border-stone-100 bg-white/80 backdrop-blur-sm">
        <CardHeader className="flex flex-col items-center space-y-2 pt-10 pb-6">
          
          {/* 🖼️ LOGO DA MARCA */}
          <div className="w-48 h-auto mb-2 flex justify-center items-center">
             <img 
               src="/img/logo.png" 
               alt="Logo Cheias de Charme" 
               className="object-contain max-h-28 w-auto drop-shadow-sm"
               onError={(e) => {
                 // Fallback caso a imagem não carregue
                 e.currentTarget.style.display = 'none';
                 e.currentTarget.parentElement!.innerHTML = '<span class="text-2xl font-serif text-[#C6A87C] font-bold">Cheias de Charme</span>';
               }}
             />
          </div>

          <h1 className="font-medium tracking-wide text-stone-600 uppercase text-xs">
            Painel Administrativo
          </h1>
        </CardHeader>

        <CardContent className="px-8 pb-10">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              
              {/* Campo Usuário */}
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-stone-600">Usuário</FormLabel>
                    <FormControl>
                      <Input placeholder="admin" {...field} className="bg-white border-stone-200 focus-visible:ring-[#C6A87C]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Campo Senha */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-stone-600">Senha</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••"
                          {...field}
                          className="bg-white border-stone-200 pr-10 focus-visible:ring-[#C6A87C]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-2.5 text-stone-400 hover:text-[#C6A87C] transition-colors"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Mensagem de Erro */}
              {serverError && (
                <Alert variant="destructive" className="py-2 bg-red-50 border-red-100 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}

              <div className="flex items-center justify-between pt-2">
                <FormField
                  control={form.control}
                  name="rememberMe"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="data-[state=checked]:bg-[#C6A87C] data-[state=checked]:border-[#C6A87C]"
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal text-stone-500 cursor-pointer">
                        Lembrar-me
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              {/* Botão Dourado igual ao do Agendamento */}
              <Button 
                type="submit" 
                className="w-full bg-[#C6A87C] hover:bg-[#B08D55] text-white font-bold tracking-wider h-11 mt-4 transition-all duration-300 shadow-md hover:shadow-lg" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ACESSANDO...
                  </>
                ) : (
                  "ENTRAR NO SISTEMA"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <div className="absolute bottom-6 text-xs text-stone-400 font-medium tracking-wide">
        &copy; 2025 CHEIAS DE CHARME
      </div>
    </div>
  );
}
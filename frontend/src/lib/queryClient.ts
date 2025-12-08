import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Lista de rotas onde o login NÃO é obrigatório
const PUBLIC_ROUTES = ["/agendamento-online", "/login"];

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const errorText = await res.text();
    let errorMessage = res.statusText;

    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.detail) {
        errorMessage = errorJson.detail;
      } else {
        const firstErrorKey = Object.keys(errorJson)[0];
        const firstErrorMessage = Array.isArray(errorJson[firstErrorKey]) 
          ? errorJson[firstErrorKey][0] 
          : errorJson[firstErrorKey];
        errorMessage = firstErrorMessage || errorText;
      }
    } catch (e) {
      errorMessage = errorText || res.statusText;
    }
    
    throw new Error(errorMessage);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
    
  const accessToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
  
  // 1. Verifica se estamos numa rota pública
  const isPublicPage = PUBLIC_ROUTES.some(route => window.location.pathname.includes(route));

  const headers = new Headers();
  if (data) {
    headers.append("Content-Type", "application/json");
  }
  
  // 2. 🚨 SÓ ENVIA O TOKEN SE NÃO FOR PÁGINA PÚBLICA
  // Isso evita que um token antigo/expirado cause erro 401 em páginas que deveriam ser livres
  if (accessToken && !isPublicPage) {
    headers.append("Authorization", `Bearer ${accessToken}`);
  }
    
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  // 3. INTERCEPTOR DE ERRO 401
  if (res.status === 401) {
    if (!isPublicPage) {
      // Se for painel admin e deu 401 -> Logout forçado
      console.warn("Sessão expirada. Redirecionando para login...");
      localStorage.removeItem('accessToken');
      sessionStorage.removeItem('accessToken');
      window.location.href = '/login';
      throw new Error("Sessão expirada");
    } else {
      // Se for página pública e deu 401 -> Apenas ignora (ou limpa o token ruim)
      // Não redireciona!
      localStorage.removeItem('accessToken');
      console.warn("Token inválido na página pública. Ignorando...");
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await apiRequest("GET", queryKey.join("/") as string);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }
    
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
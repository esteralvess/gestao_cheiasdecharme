import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const errorText = await res.text(); // Lê o corpo do erro como texto
    let errorMessage = res.statusText;

    try {
      // Tenta interpretar o texto como JSON (que é o que o Django envia)
      const errorJson = JSON.parse(errorText);
      
      // ✅ LÓGICA APRIMORADA PARA EXTRAIR A MENSAGEM
      if (errorJson.detail) {
        // Para erros gerais como "Não autenticado"
        errorMessage = errorJson.detail;
      } else {
        // Para erros de validação como {"whatsapp": ["cliente com este whatsapp já existe."]}
        // Pega a primeira mensagem de erro do primeiro campo que falhou.
        const firstErrorKey = Object.keys(errorJson)[0];
        const firstErrorMessage = errorJson[firstErrorKey][0];
        errorMessage = firstErrorMessage || errorText;
      }
    } catch (e) {
      // Se não for JSON, o texto puro é a melhor mensagem que temos
      errorMessage = errorText || res.statusText;
    }
    
    throw new Error(`${errorMessage}`); // Remove o "400:" para uma mensagem mais limpa
  }
}


// ✅ FUNÇÃO CORRIGIDA: apiRequest com inclusão do Token JWT
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
    
  // 1. Obtém o token de acesso do localStorage
  const accessToken = localStorage.getItem('accessToken')|| sessionStorage.getItem('accessToken');

  // 2. Cria e popula o objeto de cabeçalhos
  const headers = new Headers();
  
  if (data) {
    headers.append("Content-Type", "application/json");
  }
  
  // 3. ✅ CRÍTICO: Adiciona o cabeçalho JWT Bearer SEMPRE que existir token
  if (accessToken) {
    headers.append("Authorization", `Bearer ${accessToken}`);
  }
  
  // 4. ✅ DEBUG: Log para verificar se o token está sendo enviado
  console.log(`[API Request] ${method} ${url}`, {
    hasToken: !!accessToken,
    tokenPreview: accessToken ? `${accessToken.substring(0, 20)}...` : 'NONE'
  });
    
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    
    // ✅ Usar apiRequest para garantir a autenticação em consultas GET
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

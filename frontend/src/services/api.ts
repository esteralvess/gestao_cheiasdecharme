import axios, { InternalAxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';

// ----------------------------------------------------------------------
// 🌍 CONFIGURAÇÃO DA URL DA API
// ----------------------------------------------------------------------

// Tenta pegar do ambiente (Vercel). Se não tiver, usa localhost.
// DICA: No Vercel, defina VITE_API_URL sem a barra no final.
const ENV_URL = import.meta.env.VITE_API_URL;

// Lógica de Fallback Inteligente
export const API_URL = ENV_URL || 'http://localhost:8000/api';

console.log('🌐 API Base URL:', API_URL); // Debug para você ver no console do navegador

// Cria a instância do Axios
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ----------------------------------------------------------------------
// 🔒 INTERCEPTADORES (Token e Erros)
// ----------------------------------------------------------------------

// 1. Antes de enviar: Adiciona o Token JWT se existir
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// 2. Depois de receber: Trata Token Expirado (401)
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    // Se a API retornar 401 (Não autorizado) e não for a tela de login
    if (error.response && error.response.status === 401) {
      const currentPath = window.location.pathname;
      
      // Evita loop infinito se já estiver no login
      if (currentPath !== '/login') {
        console.warn("⚠️ Sessão expirada ou inválida. Redirecionando...");
        
        // Limpa tudo
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('refreshToken');
        
        // Redireciona
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ----------------------------------------------------------------------
// 📦 TIPOS
// ----------------------------------------------------------------------

interface DataPayload {
  [key: string]: any;
}

interface LoginPayload {
  username: string;
  password: string;
  rememberMe?: boolean;
}

// ----------------------------------------------------------------------
// 🚀 MÉTODOS DA API (Endpoints)
// ----------------------------------------------------------------------

export const authAPI = {
  login: async (payload: LoginPayload) => {
    // A rota /token/ é padrão do SimpleJWT
    const response = await api.post("/token/", { username: payload.username, password: payload.password });
    const data = response.data;
    
    if (data.access) {
      const storage = payload.rememberMe ? localStorage : sessionStorage;
      storage.setItem('accessToken', data.access);
      if (data.refresh) storage.setItem('refreshToken', data.refresh);
    }
    return data;
  },
  
  refresh: async (refresh_token: string) => {
    const response = await api.post("/token/refresh/", { refresh: refresh_token });
    const data = response.data;
    if (data.access) {
      // Tenta manter onde estava (local ou session)
      const storage = localStorage.getItem('refreshToken') ? localStorage : sessionStorage;
      storage.setItem('accessToken', data.access);
    }
    return data;
  },
      
  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    window.location.href = '/login';
  },
};

export const userAPI = {
  getMe: async () => (await api.get("/users/me/")).data,
  updateMe: async (data: DataPayload) => (await api.put("/users/me/", data)).data
};

export const adminAPI = {
  getUsers: async () => (await api.get("/users/")).data,
  updateUser: async (id: number, data: DataPayload) => (await api.patch(`/users/${id}/`, data)).data,
  createUser: async (data: DataPayload) => (await api.post("/users/", data)).data,
  setUserPassword: async (id: number, password: string) => (await api.post(`/users/${id}/set-password/`, { password })).data,
  getGroups: async () => (await api.get("/groups/")).data,
  getPermissions: async () => (await api.get("/permissions/")).data,
};

// --- CRUD Genéricos ---

export const locationsAPI = {
  getAll: async () => (await api.get("/locations/")).data,
  getOne: async (id: string | number) => (await api.get(`/locations/${id}/`)).data,
  create: async (data: DataPayload) => (await api.post("/locations/", data)).data,
  update: async (id: string | number, data: DataPayload) => (await api.put(`/locations/${id}/`, data)).data,
  delete: async (id: string | number) => (await api.delete(`/locations/${id}/`)).data,
};

export const staffAPI = {
  getAll: async () => (await api.get("/staff/")).data,
  getOne: async (id: string | number) => (await api.get(`/staff/${id}/`)).data,
  create: async (data: DataPayload) => (await api.post("/staff/", data)).data,
  update: async (id: string | number, data: DataPayload) => (await api.put(`/staff/${id}/`, data)).data,
  delete: async (id: string | number) => (await api.delete(`/staff/${id}/`)).data,
};

export const servicesAPI = {
  getAll: async () => (await api.get("/services/")).data,
  getOne: async (id: string | number) => (await api.get(`/services/${id}/`)).data,
  create: async (data: DataPayload) => (await api.post("/services/", data)).data,
  update: async (id: string | number, data: DataPayload) => (await api.put(`/services/${id}/`, data)).data,
  delete: async (id: string | number) => (await api.delete(`/services/${id}/`)).data,
};

export const customersAPI = {
  getAll: async () => (await api.get("/customers/")).data,
  getOne: async (id: string | number) => (await api.get(`/customers/${id}/`)).data,
  create: async (data: DataPayload) => (await api.post("/customers/", data)).data,
  update: async (id: string | number, data: DataPayload) => (await api.put(`/customers/${id}/`, data)).data,
  delete: async (id: string | number) => (await api.delete(`/customers/${id}/`)).data,
  
  redeemPoints: async (id: string, data: { points_to_redeem: number }) => (await api.post(`/customers/${id}/redeem-points/`, data)).data,
  adjustPoints: async (id: string, data: { points_to_adjust: number }) => (await api.post(`/customers/${id}/adjust-points/`, data)).data,
    
  checkPhone: async (phone: string) => (await api.get(`/customers/check-phone/?phone=${encodeURIComponent(phone)}`)).data,
};

export const appointmentsAPI = {
  getAll: async () => (await api.get("/appointments/")).data,
  getOne: async (id: string | number) => (await api.get(`/appointments/${id}/`)).data,
  create: async (data: DataPayload) => (await api.post("/appointments/", data)).data,
  update: async (id: string | number, data: DataPayload) => (await api.patch(`/appointments/${id}/`, data)).data,
  delete: async (id: string | number) => (await api.delete(`/appointments/${id}/`)).data,
};

export const staffShiftsAPI = {
  getAll: async () => (await api.get("/staff_shifts/")).data,
  create: async (data: DataPayload) => (await api.post("/staff_shifts/", data)).data,
  update: async (id: string | number, data: DataPayload) => (await api.put(`/staff_shifts/${id}/`, data)).data,
  delete: async (id: string | number) => (await api.delete(`/staff_shifts/${id}/`)).data,  
};

export const staffServicesAPI = {
  getAll: async () => (await api.get("/staff_services/")).data,
  create: async (data: DataPayload) => (await api.post("/staff_services/", data)).data,
  delete: async (queryOrId: string | number) => {
    // Suporte para deletar por ID ou por Query Params (?staff_id=...)
    if (typeof queryOrId === 'string' && (queryOrId.startsWith('delete-by-params') || queryOrId.startsWith('?'))) {
        const path = queryOrId.startsWith('?') ? `delete-by-params/${queryOrId}` : queryOrId;
        const r = await api.delete(`/staff_services/${path}`);
        return r.data;
    }
    const r = await api.delete(`/staff_services/${queryOrId}/`);
    return r.data;
  }
};

export const staffExceptionsAPI = {
  getAll: async () => (await api.get("/staff_exceptions/")).data,
  create: async (data: DataPayload) => (await api.post("/staff_exceptions/", data)).data,
  update: async (id: string | number, data: DataPayload) => (await api.patch(`/staff_exceptions/${id}/`, data)).data,
  delete: async (id: string | number) => (await api.delete(`/staff_exceptions/${id}/`)).data,
};

export const staffCommissionsAPI = {
  getAll: async () => (await api.get("/staff_commissions/")).data,
  create: async (data: DataPayload) => (await api.post("/staff_commissions/", data)).data,
  update: async (id: string | number, data: DataPayload) => (await api.patch(`/staff_commissions/${id}/`, data)).data,
  delete: async (id: string | number) => (await api.delete(`/staff_commissions/${id}/`)).data,
};

export const referralsAPI = {
  getAll: async () => (await api.get("/referrals/")).data,
  create: async (data: DataPayload) => (await api.post("/referrals/", data)).data,
  applyReward: async (id: string) => (await api.post(`/referrals/${id}/apply-reward/`)).data,
};

export const expensesAPI = {
  getAll: async () => (await api.get("/expenses/")).data,
  create: async (data: DataPayload) => (await api.post("/expenses/", data)).data,
  update: async (id: string | number, data: DataPayload) => (await api.put(`/expenses/${id}/`, data)).data,
  delete: async (id: string | number) => (await api.delete(`/expenses/${id}/`)).data,
};

export const reportsAPI = {
  getRevenueByStaff: async (startDate: string, endDate: string) => (await api.get(`/reports/revenue-by-staff/?start_date=${startDate}&end_date=${endDate}`)).data,
  getRevenueByLocation: async (startDate: string, endDate: string) => (await api.get(`/reports/revenue-by-location/?start_date=${startDate}&end_date=${endDate}`)).data,
  getRevenueByService: async (startDate: string, endDate: string) => (await api.get(`/reports/revenue-by-service/?start_date=${startDate}&end_date=${endDate}`)).data,
};

export const promotionsAPI = {
  getAll: async () => (await api.get("/promotions/")).data,
  create: async (data: DataPayload) => (await api.post("/promotions/", data)).data,
  update: async (id: string | number, data: DataPayload) => (await api.put(`/promotions/${id}/`, data)).data,
  delete: async (id: string | number) => (await api.delete(`/promotions/${id}/`)).data,
};

export default api;
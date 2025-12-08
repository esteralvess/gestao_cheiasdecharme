import axios, { InternalAxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';

// URL base da API
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_URL,
});

// Interceptor de Requisição: Adiciona o Token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Interceptor de Resposta: Trata Erros Globais (ex: Token Expirado)
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.response && error.response.status === 401) {
      // Se der 401 (Unauthorized), limpa o token e redireciona para login
      // Mas só se não estivermos já na tela de login, para evitar loop infinito
      if (window.location.pathname !== '/login') {
          console.warn("Sessão expirada. Redirecionando para login...");
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          sessionStorage.removeItem('accessToken');
          sessionStorage.removeItem('refreshToken');
          window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

interface DataPayload {
  [key: string]: any;
}

interface LoginPayload {
  username: string;
  password: string;
  rememberMe?: boolean;
}

// ----------------------------------------------------
// APIs de Autenticação (Auth)
// ----------------------------------------------------
export const authAPI = {
   login: async (payload: LoginPayload) => {
    const response = await api.post("/token/", { username: payload.username, password: payload.password });
    const data = response.data;
    if (data.access) {
        const storage = payload.rememberMe ? localStorage : sessionStorage;
        storage.setItem('accessToken', data.access);
    }
    if (data.refresh) {
        const storage = payload.rememberMe ? localStorage : sessionStorage;
        storage.setItem('refreshToken', data.refresh); 
    }
    return data;
   },
  
  refresh: async (refresh_token: string) => {
    const response = await api.post("/token/refresh/", { refresh: refresh_token });
    const data = response.data;
    if (data.access) {
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
  },
};

export const userAPI = {
  getMe: async () => {
    const response = await api.get("/users/me/");
    return response.data;
  },
  updateMe: async (data: DataPayload) => {
    const response = await api.put("/users/me/", data);
    return response.data;
  }
};

export const adminAPI = {
  getUsers: async () => { const r = await api.get("/users/"); return r.data; },
  updateUser: async (id: number, data: DataPayload) => { const r = await api.patch(`/users/${id}/`, data); return r.data; },
  createUser: async (data: DataPayload) => { const r = await api.post("/users/", data); return r.data; },
  setUserPassword: async (id: number, password: string) => { const r = await api.post(`/users/${id}/set-password/`, { password }); return r.data; },
  getGroups: async () => { const r = await api.get("/groups/"); return r.data; },
  getPermissions: async () => { const r = await api.get("/permissions/"); return r.data; },
};

// ----------------------------------------------------
// APIs de CRUD
// ----------------------------------------------------

export const locationsAPI = {
  getAll: async () => { const r = await api.get("/locations/"); return r.data; },
  getOne: async (id: string | number) => { const r = await api.get(`/locations/${id}/`); return r.data; },
  create: async (data: DataPayload) => { const r = await api.post("/locations/", data); return r.data; },
  update: async (id: string | number, data: DataPayload) => { const r = await api.put(`/locations/${id}/`, data); return r.data; },
  delete: async (id: string | number) => { const r = await api.delete(`/locations/${id}/`); return r.data; },
};

export const staffAPI = {
  getAll: async () => { const r = await api.get("/staff/"); return r.data; },
  getOne: async (id: string | number) => { const r = await api.get(`/staff/${id}/`); return r.data; },
  create: async (data: DataPayload) => { const r = await api.post("/staff/", data); return r.data; },
  update: async (id: string | number, data: DataPayload) => { const r = await api.put(`/staff/${id}/`, data); return r.data; },
  delete: async (id: string | number) => { const r = await api.delete(`/staff/${id}/`); return r.data; },
};

export const servicesAPI = {
  getAll: async () => { const r = await api.get("/services/"); return r.data; },
  getOne: async (id: string | number) => { const r = await api.get(`/services/${id}/`); return r.data; },
  create: async (data: DataPayload) => { const r = await api.post("/services/", data); return r.data; },
  update: async (id: string | number, data: DataPayload) => { const r = await api.put(`/services/${id}/`, data); return r.data; },
  delete: async (id: string | number) => { const r = await api.delete(`/services/${id}/`); return r.data; },
};

export const customersAPI = {
  getAll: async () => { const r = await api.get("/customers/"); return r.data; },
  getOne: async (id: string | number) => { const r = await api.get(`/customers/${id}/`); return r.data; },
  create: async (data: DataPayload) => { const r = await api.post("/customers/", data); return r.data; },
  update: async (id: string | number, data: DataPayload) => { const r = await api.put(`/customers/${id}/`, data); return r.data; },
  delete: async (id: string | number) => { const r = await api.delete(`/customers/${id}/`); return r.data; },
  
  redeemPoints: async (id: string, data: { points_to_redeem: number }) => {
    const r = await api.post(`/customers/${id}/redeem-points/`, data);
    return r.data;
  },
  
  adjustPoints: async (id: string, data: { points_to_adjust: number }) => {
    const r = await api.post(`/customers/${id}/adjust-points/`, data);
    return r.data;
  },
    
  checkPhone: async (phone: string) => {
    const r = await api.get(`/customers/check-phone/?phone=${encodeURIComponent(phone)}`);
    return r.data;
  },
};

export const appointmentsAPI = {
  getAll: async () => { const r = await api.get("/appointments/"); return r.data; },
  getOne: async (id: string | number) => { const r = await api.get(`/appointments/${id}/`); return r.data; },
  create: async (data: DataPayload) => { const r = await api.post("/appointments/", data); return r.data; },
  update: async (id: string | number, data: DataPayload) => { const r = await api.patch(`/appointments/${id}/`, data); return r.data; },
  delete: async (id: string | number) => { const r = await api.delete(`/appointments/${id}/`); return r.data; },
};

export const staffShiftsAPI = {
  getAll: async () => { const r = await api.get("/staff_shifts/"); return r.data; },
  create: async (data: DataPayload) => { const r = await api.post("/staff_shifts/", data); return r.data; },
  update: async (id: string | number, data: DataPayload) => { const r = await api.put(`/staff_shifts/${id}/`, data); return r.data; },
  delete: async (id: string | number) => { const r = await api.delete(`/staff_shifts/${id}/`); return r.data; },  
};

export const staffServicesAPI = {
  getAll: async () => { const r = await api.get("/staff_services/"); return r.data; },
  create: async (data: DataPayload) => { const r = await api.post("/staff_services/", data); return r.data; },
  delete: async (queryOrId: string | number) => {
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
  getAll: async () => { const r = await api.get("/staff_exceptions/"); return r.data; },
  create: async (data: DataPayload) => { const r = await api.post("/staff_exceptions/", data); return r.data; },
  update: async (id: string | number, data: DataPayload) => { const r = await api.patch(`/staff_exceptions/${id}/`, data); return r.data; },
  delete: async (id: string | number) => { const r = await api.delete(`/staff_exceptions/${id}/`); return r.data; },
};

export const staffCommissionsAPI = {
  getAll: async () => { const r = await api.get("/staff_commissions/"); return r.data; },
  create: async (data: DataPayload) => { const r = await api.post("/staff_commissions/", data); return r.data; },
  update: async (id: string | number, data: DataPayload) => { const r = await api.patch(`/staff_commissions/${id}/`, data); return r.data; },
  delete: async (id: string | number) => { const r = await api.delete(`/staff_commissions/${id}/`); return r.data; },
};

export const referralsAPI = {
  getAll: async () => { const r = await api.get("/referrals/"); return r.data; },
  create: async (data: DataPayload) => { const r = await api.post("/referrals/", data); return r.data; },
  applyReward: async (id: string) => { const r = await api.post(`/referrals/${id}/apply-reward/`); return r.data; },
};

export const expensesAPI = {
  getAll: async () => { const r = await api.get("/expenses/"); return r.data; },
  create: async (data: DataPayload) => { const r = await api.post("/expenses/", data); return r.data; },
  update: async (id: string | number, data: DataPayload) => { const r = await api.put(`/expenses/${id}/`, data); return r.data; },
  delete: async (id: string | number) => { const r = await api.delete(`/expenses/${id}/`); return r.data; },
};

export const reportsAPI = {
  getRevenueByStaff: async (startDate: string, endDate: string) => {
    const r = await api.get(`/reports/revenue-by-staff/?start_date=${startDate}&end_date=${endDate}`);
    return r.data;
  },
  getRevenueByLocation: async (startDate: string, endDate: string) => {
    const r = await api.get(`/reports/revenue-by-location/?start_date=${startDate}&end_date=${endDate}`);
    return r.data;
  },
  getRevenueByService: async (startDate: string, endDate: string) => {
    const r = await api.get(`/reports/revenue-by-service/?start_date=${startDate}&end_date=${endDate}`);
    return r.data;
  },
};

export const promotionsAPI = {
  getAll: async () => { const r = await api.get("/promotions/"); return r.data; },
  create: async (data: DataPayload) => { const r = await api.post("/promotions/", data); return r.data; },
  update: async (id: string | number, data: DataPayload) => { const r = await api.put(`/promotions/${id}/`, data); return r.data; },
  delete: async (id: string | number) => { const r = await api.delete(`/promotions/${id}/`); return r.data; },
};

export default api;
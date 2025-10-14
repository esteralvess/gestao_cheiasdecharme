import { apiRequest } from "../lib/queryClient"; 

const API_BASE = 'http://localhost:8000/api';
const getUrl = (path: string) => `${API_BASE}${path}`;

interface Credentials {
  username: string;
  password: string;
}

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
   login: (payload: LoginPayload): Promise<any> => 
    apiRequest("POST", getUrl("/token/"), { username: payload.username, password: payload.password })
      .then((res: Response) => res.json())
      .then(data => {
        if (data.access) {
            // Se "Lembrar-me" estiver marcado, usa localStorage. Senão, sessionStorage.
            const storage = payload.rememberMe ? localStorage : sessionStorage;
            storage.setItem('accessToken', data.access);
        }
        if (data.refresh) {
            const storage = payload.rememberMe ? localStorage : sessionStorage;
            storage.setItem('refreshToken', data.refresh); 
        }
        return data;
      }),
  
  refresh: (refresh_token: string): Promise<any> => 
    apiRequest("POST", getUrl("/token/refresh/"), { refresh: refresh_token })
      .then((res: Response) => res.json())
      .then(data => {
        if (data.access) {
            // Assume que se o refresh token existe, a sessão deve ser mantida onde estava
            const storage = localStorage.getItem('refreshToken') ? localStorage : sessionStorage;
            storage.setItem('accessToken', data.access);
        }
        return data;
      }),
      
  logout: (): void => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
  },
};

export const userAPI = {
  getMe: (): Promise<any> => 
    apiRequest("GET", getUrl("/users/me/"))
      .then((res: Response) => res.json()),

  updateMe: (data: DataPayload): Promise<any> => 
    apiRequest("PUT", getUrl("/users/me/"), data)
      .then((res: Response) => res.json()),
};

export const adminAPI = {
  // Usuários
  getUsers: (): Promise<any[]> => apiRequest("GET", getUrl("/users/")).then(res => res.json()),
  updateUser: (id: number, data: DataPayload): Promise<any> => apiRequest("PATCH", getUrl(`/users/${id}/`), data).then(res => res.json()),
  createUser: (data: DataPayload): Promise<any> => apiRequest("POST", getUrl("/users/"), data).then(res => res.json()),
  setUserPassword: (id: number, password: string): Promise<any> => apiRequest("POST", getUrl(`/users/${id}/set-password/`), { password }).then(res => res.json()),

  // Grupos
  getGroups: (): Promise<any[]> => apiRequest("GET", getUrl("/groups/")).then(res => res.json()),

  // Permissões
  getPermissions: (): Promise<any[]> => apiRequest("GET", getUrl("/permissions/")).then(res => res.json()),
};

// ----------------------------------------------------
// APIs de CRUD
// ----------------------------------------------------

// --- Locations ---
export const locationsAPI = {
  getAll: (): Promise<any> => apiRequest("GET", getUrl("/locations/")).then((res: Response) => res.json()),
  getOne: (id: string | number): Promise<any> => apiRequest("GET", getUrl(`/locations/${id}/`)).then((res: Response) => res.json()),
  create: (data: DataPayload): Promise<any> => apiRequest("POST", getUrl("/locations/"), data).then((res: Response) => res.json()),
  update: (id: string | number, data: DataPayload): Promise<any> => apiRequest("PUT", getUrl(`/locations/${id}/`), data).then((res: Response) => res.json()),
  delete: (id: string | number): Promise<Response> => apiRequest("DELETE", getUrl(`/locations/${id}/`)),
};

// --- Staff ---
export const staffAPI = {
  getAll: (): Promise<any> => apiRequest("GET", getUrl("/staff/")).then((res: Response) => res.json()),
  getOne: (id: string | number): Promise<any> => apiRequest("GET", getUrl(`/staff/${id}/`)).then((res: Response) => res.json()),
  create: (data: DataPayload): Promise<any> => apiRequest("POST", getUrl("/staff/"), data).then((res: Response) => res.json()),
  update: (id: string | number, data: DataPayload): Promise<any> => apiRequest("PUT", getUrl(`/staff/${id}/`), data).then((res: Response) => res.json()),
  delete: (id: string | number): Promise<Response> => apiRequest("DELETE", getUrl(`/staff/${id}/`)),
};

// --- Services ---
export const servicesAPI = {
  getAll: (): Promise<any> => apiRequest("GET", getUrl("/services/")).then((res: Response) => res.json()),
  getOne: (id: string | number): Promise<any> => apiRequest("GET", getUrl(`/services/${id}/`)).then((res: Response) => res.json()),
  create: (data: DataPayload): Promise<any> => apiRequest("POST", getUrl("/services/"), data).then((res: Response) => res.json()),
  update: (id: string | number, data: DataPayload): Promise<any> => apiRequest("PUT", getUrl(`/services/${id}/`), data).then((res: Response) => res.json()),
  delete: (id: string | number): Promise<Response> => apiRequest("DELETE", getUrl(`/services/${id}/`)),
};

// --- Customers ---
export const customersAPI = {
  getAll: (): Promise<any> => apiRequest("GET", getUrl("/customers/")).then((res: Response) => res.json()),
  getOne: (id: string | number): Promise<any> => apiRequest("GET", getUrl(`/customers/${id}/`)).then((res: Response) => res.json()),
  create: (data: DataPayload): Promise<any> => apiRequest("POST", getUrl("/customers/"), data).then((res: Response) => res.json()),
  update: (id: string | number, data: DataPayload): Promise<any> => apiRequest("PUT", getUrl(`/customers/${id}/`), data).then((res: Response) => res.json()),
  delete: (id: string | number): Promise<Response> => apiRequest("DELETE", getUrl(`/customers/${id}/`)),
  redeemPoints: (id: string, data: { points_to_redeem: number }): Promise<any> => 
    apiRequest("POST", getUrl(`/customers/${id}/redeem-points/`), data).then((res: Response) => res.json()),
  adjustPoints: (id: string, data: { points_to_adjust: number }): Promise<any> => 
    apiRequest("POST", getUrl(`/customers/${id}/adjust-points/`), data).then((res: Response) => res.json()),
};

// --- Appointments ---
export const appointmentsAPI = {
  getAll: (): Promise<any> => apiRequest("GET", getUrl("/appointments/")).then((res: Response) => res.json()),
  getOne: (id: string | number): Promise<any> => apiRequest("GET", getUrl(`/appointments/${id}/`)).then((res: Response) => res.json()),
  create: (data: DataPayload): Promise<any> => apiRequest("POST", getUrl("/appointments/"), data).then((res: Response) => res.json()),
  update: (id: string | number, data: DataPayload): Promise<any> => apiRequest("PATCH", getUrl(`/appointments/${id}/`), data).then((res: Response) => res.json()),
  delete: (id: string | number): Promise<Response> => apiRequest("DELETE", getUrl(`/appointments/${id}/`)),
};

// --- Staff Shifts ---
export const staffShiftsAPI = {
  getAll: () => apiRequest("GET", getUrl("/staff_shifts/")).then((res: Response) => res.json()),
  create: (data: DataPayload) => apiRequest("POST", getUrl("/staff_shifts/"), data).then((res: Response) => res.json()),
  update: (id: string | number, data: DataPayload) => apiRequest("PUT", getUrl(`/staff_shifts/${id}/`), data).then((res: Response) => res.json()),
  delete: (id: string | number) => apiRequest("DELETE", getUrl(`/staff_shifts/${id}/`)).then((res: Response) => res.json()),  
};

// --- Staff Services ---
export const staffServicesAPI = {
  getAll: (): Promise<any> => apiRequest("GET", getUrl("/staff_services/")).then((res: Response) => res.json()),
  create: (data: DataPayload): Promise<any> => apiRequest("POST", getUrl("/staff_services/"), data).then((res: Response) => res.json()),
  delete: (queryOrId: string | number): Promise<Response> => {
    if (typeof queryOrId === 'string' && (queryOrId.startsWith('delete-by-params') || queryOrId.startsWith('?'))) {
        const path = queryOrId.startsWith('?') ? `delete-by-params/${queryOrId}` : queryOrId;
        const url = getUrl(`/staff_services/${path}`);
        return apiRequest("DELETE", url);
    }
    return apiRequest("DELETE", getUrl(`/staff_services/${queryOrId}/`));
  }
};

// --- Staff Exceptions ---
export const staffExceptionsAPI = {
  getAll: () => apiRequest("GET", getUrl("/staff_exceptions/")).then((res: Response) => res.json()),
  create: (data: DataPayload) => apiRequest("POST", getUrl("/staff_exceptions/"), data).then((res: Response) => res.json()),
  update: (id: string | number, data: DataPayload) => apiRequest("PATCH", getUrl(`/staff_exceptions/${id}/`), data).then((res: Response) => res.json()),
  delete: (id: string | number) => apiRequest("DELETE", getUrl(`/staff_exceptions/${id}/`)).then((res: Response) => res.json()),
};

// --- Staff Commissions ---
export const staffCommissionsAPI = {
  getAll: () => apiRequest("GET", getUrl("/staff_commissions/")).then((res: Response) => res.json()),
  create: (data: DataPayload) => apiRequest("POST", getUrl("/staff_commissions/"), data).then((res: Response) => res.json()),
  update: (id: string | number, data: DataPayload) => apiRequest("PATCH", getUrl(`/staff_commissions/${id}/`), data).then((res: Response) => res.json()),
  delete: (id: string | number) => apiRequest("DELETE", getUrl(`/staff_commissions/${id}/`)).then((res: Response) => res.json()),
};

// --- Referrals ---
export const referralsAPI = {
  getAll: (): Promise<any> => apiRequest("GET", getUrl("/referrals/")).then((res: Response) => res.json()),
  create: (data: DataPayload): Promise<any> => apiRequest("POST", getUrl("/referrals/"), data).then((res: Response) => res.json()),
  applyReward: (id: string): Promise<any> => apiRequest("POST", getUrl(`/referrals/${id}/apply-reward/`)).then((res: Response) => res.json()),
};

// --- Expenses ---
export const expensesAPI = {
  getAll: (): Promise<any> => apiRequest("GET", getUrl("/expenses/")).then((res: Response) => res.json()),
  create: (data: DataPayload): Promise<any> => apiRequest("POST", getUrl("/expenses/"), data).then((res: Response) => res.json()),
  update: (id: string | number, data: DataPayload): Promise<any> => apiRequest("PUT", getUrl(`/expenses/${id}/`), data).then((res: Response) => res.json()),
  delete: (id: string | number): Promise<Response> => apiRequest("DELETE", getUrl(`/expenses/${id}/`)),
};

// --- Reports ---
export const reportsAPI = {
  getRevenueByStaff: (startDate: string, endDate: string): Promise<any> => 
    apiRequest("GET", getUrl(`/reports/revenue-by-staff/?start_date=${startDate}&end_date=${endDate}`))
      .then((res: Response) => res.json()),

  getRevenueByLocation: (startDate: string, endDate: string): Promise<any> => 
    apiRequest("GET", getUrl(`/reports/revenue-by-location/?start_date=${startDate}&end_date=${endDate}`))
      .then((res: Response) => res.json()),
      
  getRevenueByService: (startDate: string, endDate: string): Promise<any> => 
    apiRequest("GET", getUrl(`/reports/revenue-by-service/?start_date=${startDate}&end_date=${endDate}`))
      .then((res: Response) => res.json()),
};
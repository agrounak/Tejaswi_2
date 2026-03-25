import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────
export const authAPI = {
  login: (username, password) =>
    api.post('/auth/login', { username, password }),
  register: (data) =>
    api.post('/auth/register', data),
  getUsers: () =>
    api.get('/auth/users'),
  deleteUser: (id) =>
    api.delete(`/auth/users/${id}`),
};

// ── Orders ────────────────────────────────────────────
export const ordersAPI = {
  create: (data) =>
    api.post('/orders', data),
  parse: (data) =>
    api.post('/orders/parse', data),
  list: (params) =>
    api.get('/orders', { params }),
  get: (id) =>
    api.get(`/orders/${id}`),
  update: (id, data) =>
    api.put(`/orders/${id}`, data),
  delete: (id) =>
    api.delete(`/orders/${id}`),
  getConfigs: () =>
    api.get('/orders/configs'),
  addConfig: (data) =>
    api.post('/orders/config', data),
  deleteConfig: (id) =>
    api.delete(`/orders/config/${id}`),
};

// ── Planning ──────────────────────────────────────────
export const planningAPI = {
  preview: (data) =>
    api.post('/planning/preview', data),
  generate: (data) =>
    api.post('/planning/generate', data),
  getRuns: (params) =>
    api.get('/planning/runs', { params }),
  updateRun: (id, data) =>
    api.put(`/planning/runs/${id}`, data),
  deleteRun: (id) =>
    api.delete(`/planning/runs/${id}`),
  clearPlans: () =>
    api.post('/planning/clear'),
};

// ── Schedule ──────────────────────────────────────────
export const scheduleAPI = {
  get: (params) =>
    api.get('/schedule', { params }),
  getSummary: () =>
    api.get('/schedule/summary'),
};

// ── Dashboard ─────────────────────────────────────────
export const dashboardAPI = {
  getSummary: () =>
    api.get('/dashboard/summary'),
  getAnalytics: () =>
    api.get('/dashboard/analytics'),
};

const API = {
  auth: authAPI,
  orders: ordersAPI,
  planning: planningAPI,
  schedule: scheduleAPI,
  dashboard: dashboardAPI,
};

export default API;

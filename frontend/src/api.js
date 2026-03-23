import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const axiosInstance = axios.create({
  baseURL: API_BASE,
})

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

const API = {
  auth: {
    login: (username, password) =>
      axiosInstance.post('/auth/login', { username, password }),
    register: (data) => axiosInstance.post('/auth/register', data),
    getUsers: () => axiosInstance.get('/auth/users'),
    deleteUser: (id) => axiosInstance.delete(`/auth/users/${id}`),
  },

  production: {
    createEntry: (data) => axiosInstance.post('/production/entry', data),
    getProducts: (params) => axiosInstance.get('/production/products', { params }),
    getProduct: (id) => axiosInstance.get(`/production/products/${id}`),
    updateProduct: (id, data) =>
      axiosInstance.put(`/production/products/${id}`, data),
    deleteProduct: (id) => axiosInstance.delete(`/production/products/${id}`),
    scanProduct: (product_number) =>
      axiosInstance.get(`/production/scan/${encodeURIComponent(product_number)}`),
  },

  sticker: {
    getPreview: (id) =>
      axiosInstance.get(`/sticker/${id}/preview`, { responseType: 'blob' }),
    download: (id) =>
      axiosInstance.get(`/sticker/${id}`, { responseType: 'blob' }),
  },

  inventory: {
    getStock: (params) => axiosInstance.get('/inventory/stock', { params }),
    getSummary: () => axiosInstance.get('/inventory/summary'),
    getLocations: () => axiosInstance.get('/inventory/locations'),
    exportCSV: (params) =>
      axiosInstance.get('/inventory/export', { params, responseType: 'blob' }),
    receive: (data) => axiosInstance.post('/inventory/receive', data),
  },

  dispatch: {
    start: (data) => axiosInstance.post('/dispatch/start', data),
    list: () => axiosInstance.get('/dispatch'),
    history: (params) => axiosInstance.get('/dispatch/history', { params }),
    get: (id) => axiosInstance.get(`/dispatch/${id}`),
    updateDetails: (id, data) =>
      axiosInstance.put(`/dispatch/${id}/details`, data),
    scan: (id, data) => axiosInstance.post(`/dispatch/${id}/scan`, data),
    removeItem: (id, itemId) =>
      axiosInstance.delete(`/dispatch/${id}/remove/${itemId}`),
    roughSlip: (id) =>
      axiosInstance.post(`/dispatch/${id}/rough-slip`, {}, { responseType: 'blob' }),
    finalSlip: (id) =>
      axiosInstance.post(`/dispatch/${id}/final-slip`, {}, { responseType: 'blob' }),
    finalize: (id) => axiosInstance.post(`/dispatch/${id}/finalize`),
    getSheet: (id) =>
      axiosInstance.get(`/dispatch/${id}/sheet`, { responseType: 'blob' }),
  },

  orders: {
    create: (data) => axiosInstance.post('/orders', data),
    list: (params) => axiosInstance.get('/orders', { params }),
    get: (id) => axiosInstance.get(`/orders/${id}`),
    update: (id, data) => axiosInstance.put(`/orders/${id}`, data),
    allocate: (id) => axiosInstance.post(`/orders/${id}/allocate`),
  },

  dashboard: {
    getSummary: () => axiosInstance.get('/dashboard/summary'),
    getAnalytics: () => axiosInstance.get('/dashboard/analytics'),
  },

  config: {
    list: (type) => axiosInstance.get('/config', { params: type ? { type } : {} }),
    create: (data) => axiosInstance.post('/config', data),
    remove: (id) => axiosInstance.delete(`/config/${id}`),
    seed: () => axiosInstance.post('/config/seed'),
  },
}

export default API

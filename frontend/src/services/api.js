import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

// Attach auth token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ==================== AUTH ====================
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
};

// ==================== COMPLAINTS ====================
export const complaintsAPI = {
  create: (formData) => api.post('/complaints', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getAll: (params) => api.get('/complaints', { params }),
  getById: (id) => api.get(`/complaints/${id}`),
  update: (id, data) => api.patch(`/complaints/${id}`, data),
  getDuplicates: (id) => api.get(`/complaints/${id}/duplicates`),
  getNearby: (params) => api.get('/complaints/nearby', { params }),
};

// ==================== ANALYTICS ====================
export const analyticsAPI = {
  getOverview: () => api.get('/analytics/overview'),
  getHeatmap: () => api.get('/analytics/heatmap'),
  getTrends: (days) => api.get('/analytics/trends', { params: { days } }),
  getResponseTimes: () => api.get('/analytics/response-times'),
  getRiskAreas: () => api.get('/analytics/risk-areas'),
  getDuplicates: () => api.get('/analytics/duplicates'),
};

// ==================== DEPARTMENTS ====================
export const departmentsAPI = {
  getAll: () => api.get('/departments'),
  getById: (id) => api.get(`/departments/${id}`),
  getAssignments: (id, params) => api.get(`/departments/${id}/assignments`, { params }),
  getWorkers: (id) => api.get(`/departments/${id}/workers`),
  createAssignment: (id, data) => api.post(`/departments/${id}/assignments`, data),
  updateAssignment: (id, data) => api.patch(`/departments/assignments/${id}`, data),
  getPerformance: () => api.get('/departments/performance'),
};

// ==================== CCTV ====================
export const cctvAPI = {
  getStreams: () => api.get('/cctv/streams'),
  addStream: (data) => api.post('/cctv/streams', data),
  analyzeFrame: (data) => api.post('/cctv/analyze', data),
  getAlerts: () => api.get('/cctv/alerts'),
};

// ==================== ADMIN ====================
export const adminAPI = {
  getPriorities: (params) => api.get('/admin/priorities', { params }),
  configurePriorities: (data) => api.post('/admin/priorities/configure', data),
  getUsers: () => api.get('/admin/users'),
  updateUserRole: (id, data) => api.patch(`/admin/users/${id}/role`, data),
};

export default api;

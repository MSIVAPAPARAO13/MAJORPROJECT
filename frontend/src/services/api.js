import axios from 'axios';

let csrfTokenCache = null;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true, // Send session cookies for authentication
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    if (!csrfTokenCache) {
      try {
        const baseURL = import.meta.env.VITE_API_URL || '/api';
        const res = await axios.get(`${baseURL}/csrf-token`, {
          withCredentials: true,
        });
        if (res.data && res.data.csrfToken) {
          csrfTokenCache = res.data.csrfToken;
        }
      } catch (err) {
        console.warn('Failed to fetch CSRF token:', err.message);
      }
    }
    if (csrfTokenCache) {
      config.headers['X-CSRF-Token'] = csrfTokenCache;
    }
  }
  return config;
});

// Clear cache on CSRF error so retry fetches fresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 403 && error.response.data?.message?.includes('CSRF')) {
      csrfTokenCache = null;
    }
    return Promise.reject(error);
  }
);

export default api;

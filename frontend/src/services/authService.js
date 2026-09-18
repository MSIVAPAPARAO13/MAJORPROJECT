import api from './api';

export const authService = {
  // Check active session user
  async getMe() {
    const response = await api.get('/auth/me');
    return response.data;
  },

  // Authenticate user
  async login(credentials) {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  // Register user
  async signup(userData) {
    const response = await api.post('/auth/signup', userData);
    return response.data;
  },

  // Log out session
  async logout() {
    const response = await api.post('/auth/logout');
    return response.data;
  },
};

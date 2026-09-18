import api from './api';

export const listingService = {
  // Fetch listings with query params (category, search keyword)
  async getAll(params = {}) {
    const response = await api.get('/listings', { params });
    return response.data;
  },

  // Fetch single listing by ID with populated rooms and reviews
  async getById(id) {
    const response = await api.get(`/listings/${id}`);
    return response.data;
  },
};

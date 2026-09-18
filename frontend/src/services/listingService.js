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

  // Add a review
  async addReview(listingId, reviewData) {
    const response = await api.post(`/listings/${listingId}/reviews`, { review: reviewData });
    return response.data;
  },

  // Delete a review
  async deleteReview(listingId, reviewId) {
    const response = await api.delete(`/listings/${listingId}/reviews/${reviewId}`);
    return response.data;
  },
};

import api from './api';

export const bookingService = {
  // Create an atomic reservation
  async createBooking(bookingData) {
    const response = await api.post('/bookings', { booking: bookingData });
    return response.data;
  },

  // Get current user's reservations
  async getMyBookings() {
    const response = await api.get('/bookings/my');
    return response.data;
  },
};

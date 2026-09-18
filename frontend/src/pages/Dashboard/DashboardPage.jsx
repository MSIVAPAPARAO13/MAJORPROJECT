import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const DashboardPage = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/metrics');
      if (res.data.success) {
        setMetrics(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-danger" role="status">
          <span className="visually-hidden">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container my-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold mb-1">
            {user?.role === 'OWNER' ? 'Property Owner Control Center' : 'Traveler Reservations Portal'}
          </h2>
          <p className="text-muted small mb-0">Welcome back, {user?.username} ({user?.role})</p>
        </div>
        <Link to="/" className="btn btn-outline-secondary rounded-pill px-4 small">
          Explore Stays
        </Link>
      </div>

      {/* Metrics Row */}
      {user?.role === 'OWNER' || user?.role === 'ADMIN' ? (
        <div className="row g-3 mb-4">
          <div className="col-md-3 col-6">
            <div className="card border-0 shadow-sm rounded-4 p-3 bg-white">
              <span className="text-muted small">Properties</span>
              <h3 className="fw-bold text-dark mt-1 mb-0">{metrics?.totalProperties || 0}</h3>
            </div>
          </div>
          <div className="col-md-3 col-6">
            <div className="card border-0 shadow-sm rounded-4 p-3 bg-white">
              <span className="text-muted small">Total Rooms</span>
              <h3 className="fw-bold text-dark mt-1 mb-0">{metrics?.totalRooms || 0}</h3>
            </div>
          </div>
          <div className="col-md-3 col-6">
            <div className="card border-0 shadow-sm rounded-4 p-3 bg-white">
              <span className="text-muted small">Active Reservations</span>
              <h3 className="fw-bold text-primary mt-1 mb-0">{metrics?.activeBookings || 0}</h3>
            </div>
          </div>
          <div className="col-md-3 col-6">
            <div className="card border-0 shadow-sm rounded-4 p-3 bg-white">
              <span className="text-muted small">Total Revenue</span>
              <h3 className="fw-bold text-success mt-1 mb-0">&#8377; {(metrics?.totalRevenue || 0).toLocaleString('en-IN')}</h3>
            </div>
          </div>
        </div>
      ) : null}

      {/* Bookings Table / List */}
      <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
        <h5 className="fw-bold mb-3">Reservations & Trips</h5>
        {metrics?.bookings && metrics.bookings.length > 0 ? (
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr className="text-muted small">
                  <th>PROPERTY / ROOM</th>
                  <th>DATES</th>
                  <th>GUESTS</th>
                  <th>AMOUNT</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {metrics.bookings.map((b) => (
                  <tr key={b._id}>
                    <td>
                      <b>{b.property?.title || 'WanderLust Stay'}</b>
                      <small className="d-block text-muted">Room: {b.room?.roomNumber || 'Standard'}</small>
                    </td>
                    <td>
                      <small>
                        {new Date(b.checkIn).toLocaleDateString()} &rarr; {new Date(b.checkOut).toLocaleDateString()}
                      </small>
                    </td>
                    <td>{b.guestsCount} Guests</td>
                    <td><b>&#8377; {b.totalPrice?.toLocaleString('en-IN')}</b></td>
                    <td>
                      <span className="badge bg-success bg-opacity-10 text-success rounded-pill px-3">
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-4 text-muted">
            <i className="fa-solid fa-suitcase-rolling fa-2x mb-2 opacity-50"></i>
            <p className="small mb-0">No active bookings found.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;

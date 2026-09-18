import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const RegisterPage = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('CUSTOMER');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await signup({ username, email, password, role, phone });
      if (res.success) {
        navigate(role === 'OWNER' ? '/dashboard' : '/');
      } else {
        setError(res.message || 'Registration failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please check inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container my-5">
      <div className="row justify-content-center">
        <div className="col-md-6 col-sm-9">
          <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white">
            <div className="text-center mb-4">
              <i className="fa-regular fa-compass text-danger fa-3x mb-2"></i>
              <h3 className="fw-bold">Create Account</h3>
              <p className="text-muted small">Join WanderLust to explore or host unique stays</p>
            </div>

            {error && <div className="alert alert-danger small py-2 rounded-3">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label small fw-semibold">Account Type</label>
                <div className="row g-2">
                  <div className="col-6">
                    <button
                      type="button"
                      className={`btn w-100 py-2 rounded-3 small fw-semibold ${
                        role === 'CUSTOMER' ? 'btn-danger' : 'btn-outline-secondary'
                      }`}
                      onClick={() => setRole('CUSTOMER')}
                    >
                      <i className="fa-solid fa-plane-departure me-1"></i> Traveler
                    </button>
                  </div>
                  <div className="col-6">
                    <button
                      type="button"
                      className={`btn w-100 py-2 rounded-3 small fw-semibold ${
                        role === 'OWNER' ? 'btn-danger' : 'btn-outline-secondary'
                      }`}
                      onClick={() => setRole('OWNER')}
                    >
                      <i className="fa-solid fa-house-user me-1"></i> Property Host
                    </button>
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold">Username</label>
                <input
                  type="text"
                  className="form-control rounded-3"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. wanderer_john"
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold">Email Address</label>
                <input
                  type="email"
                  className="form-control rounded-3"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold">Phone Number</label>
                <input
                  type="tel"
                  className="form-control rounded-3"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
                />
              </div>

              <div className="mb-4">
                <label className="form-label small fw-semibold">Password</label>
                <input
                  type="password"
                  className="form-control rounded-3"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Choose a strong password"
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-danger w-100 py-2 rounded-pill fw-bold shadow-sm"
                disabled={loading}
              >
                {loading ? 'Registering...' : 'Complete Sign Up'}
              </button>
            </form>

            <div className="text-center mt-4 pt-2 border-top">
              <span className="small text-muted">Already have an account? </span>
              <Link to="/login" className="small text-danger fw-bold text-decoration-none">
                Log in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;

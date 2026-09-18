import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await login({ username, password });
      if (res.success) {
        navigate(res.user?.role === 'OWNER' ? '/dashboard' : '/');
      } else {
        setError(res.message || 'Invalid credentials');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container my-5">
      <div className="row justify-content-center">
        <div className="col-md-5 col-sm-8">
          <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white">
            <div className="text-center mb-4">
              <i className="fa-regular fa-compass text-danger fa-3x mb-2"></i>
              <h3 className="fw-bold">Welcome to WanderLust</h3>
              <p className="text-muted small">Log in to manage stays and access reservations</p>
            </div>

            {error && <div className="alert alert-danger small py-2 rounded-3">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label small fw-semibold">Username</label>
                <input
                  type="text"
                  className="form-control rounded-3"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="form-label small fw-semibold">Password</label>
                <input
                  type="password"
                  className="form-control rounded-3"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-danger w-100 py-2 rounded-pill fw-bold shadow-sm"
                disabled={loading}
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>

            <div className="text-center mt-4 pt-2 border-top">
              <span className="small text-muted">Don't have an account? </span>
              <Link to="/register" className="small text-danger fw-bold text-decoration-none">
                Create one
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

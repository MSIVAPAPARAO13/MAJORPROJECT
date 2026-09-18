import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav className="navbar navbar-expand-md bg-white border-bottom sticky-top py-3">
      <div className="container">
        {/* Brand */}
        <Link to="/" className="navbar-brand d-flex align-items-center gap-2 text-decoration-none">
          <i className="fa-regular fa-compass text-danger fa-xl"></i>
          <span className="fw-bold text-dark fs-4">WanderLust</span>
        </Link>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="d-none d-md-flex align-items-center mx-auto" style={{ maxWidth: '380px', width: '100%' }}>
          <div className="input-group rounded-pill border shadow-sm px-2 py-1 bg-white">
            <input
              type="text"
              className="form-control border-0 search-input shadow-none small"
              placeholder="Search destinations, villas, hostels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="btn btn-danger rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }} type="submit">
              <i className="fa-solid fa-magnifying-glass fa-xs"></i>
            </button>
          </div>
        </form>

        {/* Right Navigation */}
        <div className="d-flex align-items-center gap-3">
          <Link to="/" className="text-secondary text-decoration-none fw-semibold small d-none d-lg-inline">
            Explore
          </Link>
          
          <Link to="/trust" className="text-secondary text-decoration-none fw-semibold small d-none d-lg-inline">
            Trust & Safety
          </Link>

          {user ? (
            <div className="dropdown">
              <button className="btn btn-outline-secondary rounded-pill d-flex align-items-center gap-2 px-3 py-1 shadow-sm" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                <i className="fa-solid fa-bars fa-sm"></i>
                <i className="fa-solid fa-circle-user text-secondary fa-lg"></i>
                <span className="small fw-bold text-dark">{user.username}</span>
              </button>
              <ul className="dropdown-menu dropdown-menu-end shadow-sm border-0 rounded-3 mt-2">
                <li><span className="dropdown-item-text small text-muted">Signed in as <b>{user.role}</b></span></li>
                <li><hr className="dropdown-divider" /></li>
                <li><Link className="dropdown-item small" to="/dashboard"><i className="fa-solid fa-gauge text-primary me-2"></i>Dashboard</Link></li>
                <li><button className="dropdown-item small text-danger" onClick={handleLogout}><i className="fa-solid fa-right-from-bracket me-2"></i>Log out</button></li>
              </ul>
            </div>
          ) : (
            <div className="d-flex align-items-center gap-2">
              <Link to="/login" className="btn btn-outline-secondary rounded-pill px-3 py-1 small fw-semibold">
                Log in
              </Link>
              <Link to="/register" className="btn btn-danger rounded-pill px-3 py-1 small fw-semibold shadow-sm">
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

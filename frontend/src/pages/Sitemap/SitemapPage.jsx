import React from 'react';
import { Link } from 'react-router-dom';

const SitemapPage = () => {
  return (
    <div className="container my-5">
      <div className="row justify-content-center">
        <div className="col-lg-10">
          <div className="mb-4 text-center">
            <span className="badge bg-danger bg-opacity-10 text-danger px-3 py-2 rounded-pill fw-semibold mb-2">Platform Navigation</span>
            <h1 className="fw-bold mb-2">Platform Sitemap</h1>
            <p className="text-muted small">Complete index of public routes, category catalogs, and SaaS management portals.</p>
          </div>

          <div className="row g-4">
            {/* 1. Explore */}
            <div className="col-md-4">
              <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100">
                <h5 className="fw-bold text-dark mb-3"><i className="fa-solid fa-compass text-danger me-2"></i>Explore Stays</h5>
                <ul className="list-unstyled mb-0" style={{ lineHeight: 2 }}>
                  <li><Link to="/" className="text-decoration-none text-secondary"><i className="fa-solid fa-angle-right me-1 text-danger small"></i> Explore All Properties</Link></li>
                  <li><Link to="/?category=Hostels" className="text-decoration-none text-secondary"><i className="fa-solid fa-angle-right me-1 text-danger small"></i> Backpacker Hostels</Link></li>
                  <li><Link to="/?category=Rooms" className="text-decoration-none text-secondary"><i className="fa-solid fa-angle-right me-1 text-danger small"></i> Private Rooms</Link></li>
                  <li><Link to="/?category=Trending" className="text-decoration-none text-secondary"><i className="fa-solid fa-angle-right me-1 text-danger small"></i> Trending Stays</Link></li>
                  <li><Link to="/?category=Mountains" className="text-decoration-none text-secondary"><i className="fa-solid fa-angle-right me-1 text-danger small"></i> Mountain Chalets</Link></li>
                  <li><Link to="/?category=Camping" className="text-decoration-none text-secondary"><i className="fa-solid fa-angle-right me-1 text-danger small"></i> Glamping & Campsites</Link></li>
                  <li><Link to="/?category=Arctic" className="text-decoration-none text-secondary"><i className="fa-solid fa-angle-right me-1 text-danger small"></i> Arctic Lodges</Link></li>
                  <li><Link to="/?category=Boats" className="text-decoration-none text-secondary"><i className="fa-solid fa-angle-right me-1 text-danger small"></i> Houseboats</Link></li>
                </ul>
              </div>
            </div>

            {/* 2. Hosting & SaaS */}
            <div className="col-md-4">
              <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100">
                <h5 className="fw-bold text-dark mb-3"><i className="fa-solid fa-chart-line text-primary me-2"></i>Hosting & SaaS</h5>
                <ul className="list-unstyled mb-0" style={{ lineHeight: 2 }}>
                  <li><a href="http://localhost:8080/listings/new" className="text-decoration-none text-secondary"><i className="fa-solid fa-angle-right me-1 text-primary small"></i> List New Property</a></li>
                  <li><a href="http://localhost:8080/organizations/new" className="text-decoration-none text-secondary"><i className="fa-solid fa-angle-right me-1 text-primary small"></i> Register Organization</a></li>
                  <li><Link to="/dashboard" className="text-decoration-none text-secondary"><i className="fa-solid fa-angle-right me-1 text-primary small"></i> Owner Dashboard</Link></li>
                  <li><Link to="/dashboard" className="text-decoration-none text-secondary"><i className="fa-solid fa-angle-right me-1 text-primary small"></i> Customer Reservations</Link></li>
                  <li><Link to="/login" className="text-decoration-none text-secondary"><i className="fa-solid fa-angle-right me-1 text-primary small"></i> Manager Portal</Link></li>
                </ul>

                <h5 className="fw-bold text-dark mt-4 mb-3"><i className="fa-solid fa-user-lock text-success me-2"></i>Accounts</h5>
                <ul className="list-unstyled mb-0" style={{ lineHeight: 2 }}>
                  <li><Link to="/login" className="text-decoration-none text-secondary"><i className="fa-solid fa-angle-right me-1 text-success small"></i> User Login</Link></li>
                  <li><Link to="/register" className="text-decoration-none text-secondary"><i className="fa-solid fa-angle-right me-1 text-success small"></i> Create Account</Link></li>
                </ul>
              </div>
            </div>

            {/* 3. Trust & Legal */}
            <div className="col-md-4">
              <div className="card border-0 shadow-sm rounded-4 p-4 bg-white h-100">
                <h5 className="fw-bold text-dark mb-3"><i className="fa-solid fa-shield-halved text-info me-2"></i>Trust & Legal</h5>
                <ul className="list-unstyled mb-0" style={{ lineHeight: 2 }}>
                  <li><Link to="/trust" className="text-decoration-none text-secondary"><i className="fa-solid fa-angle-right me-1 text-info small"></i> Verified Stays Guarantee</Link></li>
                  <li><Link to="/trust#support" className="text-decoration-none text-secondary"><i className="fa-solid fa-angle-right me-1 text-info small"></i> 24/7 Booking Support</Link></li>
                  <li><Link to="/trust#security" className="text-decoration-none text-secondary"><i className="fa-solid fa-angle-right me-1 text-info small"></i> Secure Payments & Privacy</Link></li>
                  <li><Link to="/privacy" className="text-decoration-none text-secondary"><i className="fa-solid fa-angle-right me-1 text-info small"></i> Privacy Policy</Link></li>
                  <li><Link to="/terms" className="text-decoration-none text-secondary"><i className="fa-solid fa-angle-right me-1 text-info small"></i> Terms of Service</Link></li>
                  <li><Link to="/sitemap" className="text-decoration-none text-danger fw-bold"><i className="fa-solid fa-angle-right me-1 text-danger small"></i> Platform Sitemap</Link></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SitemapPage;

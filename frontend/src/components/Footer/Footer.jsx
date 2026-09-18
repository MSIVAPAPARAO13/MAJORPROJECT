import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="mt-auto border-top py-5 bg-light">
      <div className="container">
        <div className="row g-4 justify-content-between">
          {/* Brand & Mission */}
          <div className="col-lg-4 col-md-6">
            <div className="d-flex align-items-center gap-2 mb-2">
              <i className="fa-regular fa-compass text-danger fa-xl"></i>
              <span className="fw-bold fs-5 text-dark">WanderLust</span>
            </div>
            <p className="text-muted small mb-3">
              WanderLust is an enterprise-grade multi-tenant hospitality platform connecting travelers with verified vacation homes, hostels, and boutique stays worldwide.
            </p>
            <div className="d-flex gap-3 text-secondary">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-secondary text-decoration-none" aria-label="Facebook"><i className="fa-brands fa-facebook fa-lg"></i></a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-secondary text-decoration-none" aria-label="Instagram"><i className="fa-brands fa-instagram fa-lg"></i></a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-secondary text-decoration-none" aria-label="Twitter"><i className="fa-brands fa-x-twitter fa-lg"></i></a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-secondary text-decoration-none" aria-label="LinkedIn"><i className="fa-brands fa-linkedin fa-lg"></i></a>
            </div>
          </div>

          {/* Quick Exploration Links */}
          <div className="col-lg-2 col-6">
            <h6 className="fw-bold text-dark mb-3">Explore Stays</h6>
            <ul className="list-unstyled small text-muted mb-0">
              <li className="mb-2"><Link to="/?category=Hostels" className="text-secondary text-decoration-none">Backpacker Hostels</Link></li>
              <li className="mb-2"><Link to="/?category=Rooms" className="text-secondary text-decoration-none">Private Rooms</Link></li>
              <li className="mb-2"><Link to="/?category=Trending" className="text-secondary text-decoration-none">Trending Villas</Link></li>
              <li className="mb-2"><Link to="/?category=Mountains" className="text-secondary text-decoration-none">Mountain Chalets</Link></li>
            </ul>
          </div>

          {/* Hosting / SaaS Links */}
          <div className="col-lg-2 col-6">
            <h6 className="fw-bold text-dark mb-3">Hosting & SaaS</h6>
            <ul className="list-unstyled small text-muted mb-0">
              <li className="mb-2"><a href="http://localhost:8080/listings/new" className="text-secondary text-decoration-none">Host Your Property</a></li>
              <li className="mb-2"><a href="http://localhost:8080/organizations/new" className="text-secondary text-decoration-none">Register Organization</a></li>
              <li className="mb-2"><Link to="/dashboard" className="text-secondary text-decoration-none">Owner Dashboard</Link></li>
              <li className="mb-2"><Link to="/login" className="text-secondary text-decoration-none">Manager Portal</Link></li>
            </ul>
          </div>

          {/* Support & Trust */}
          <div className="col-lg-3 col-md-6">
            <h6 className="fw-bold text-dark mb-3">Support & Trust</h6>
            <ul className="list-unstyled small text-muted mb-0">
              <li className="mb-2">
                <Link to="/trust#guarantee" className="text-secondary text-decoration-none">Verified Stays Guarantee</Link>
              </li>
              <li className="mb-2">
                <Link to="/trust#support" className="text-secondary text-decoration-none">
                  <i className="fa-solid fa-clock text-primary me-1"></i> 24/7 Booking Support
                </Link>
              </li>
              <li className="mb-2">
                <Link to="/trust#security" className="text-secondary text-decoration-none">
                  <i className="fa-solid fa-lock text-danger me-1"></i> Secure Payments & Privacy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <hr className="my-4 text-secondary opacity-25" />

        <div className="d-flex flex-wrap justify-content-between align-items-center small text-muted">
          <span>&copy; {new Date().getFullYear()} WanderLust Hospitality Platform. All rights reserved.</span>
          <div className="d-flex gap-3 mt-2 mt-sm-0">
            <Link to="/terms" className="text-secondary text-decoration-none">Terms of Service</Link>
            <Link to="/privacy" className="text-secondary text-decoration-none">Privacy Policy</Link>
            <Link to="/sitemap" className="text-secondary text-decoration-none">Sitemap</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

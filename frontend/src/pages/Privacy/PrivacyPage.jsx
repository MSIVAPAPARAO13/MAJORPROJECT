import React from 'react';
import { Link } from 'react-router-dom';

const PrivacyPage = () => {
  return (
    <div className="container my-5">
      <div className="row justify-content-center">
        <div className="col-lg-9 col-md-11">
          <div className="mb-4 text-center">
            <span className="badge bg-danger bg-opacity-10 text-danger px-3 py-2 rounded-pill fw-semibold mb-2">Legal & Compliance</span>
            <h1 className="fw-bold mb-2">Privacy Policy</h1>
            <p className="text-muted small">Effective Date: September 2026 &bull; Last Updated: Today</p>
          </div>

          <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white">
            <div className="mb-4 pb-3 border-bottom">
              <h5 className="fw-bold text-dark mb-2"><i className="fa-solid fa-shield-halved text-danger me-2"></i>Our Commitment to Your Privacy</h5>
              <p className="text-secondary" style={{ lineHeight: '1.8' }}>
                At <b>WanderLust</b>, we take the confidentiality of your personal information seriously. This Privacy Policy details how we collect, process, safeguard, and disclose data when you use our multi-tenant property management platform, explore listings, and make reservations.
              </p>
            </div>

            <div className="mb-4">
              <h5 className="fw-bold text-dark mb-2">1. Information We Collect</h5>
              <ul className="text-secondary" style={{ lineHeight: '1.8' }}>
                <li><b>Account Identifiers:</b> Username, email address, password hash, role (<code>CUSTOMER</code>, <code>OWNER</code>, <code>MANAGER</code>), and phone number.</li>
                <li><b>Reservation Information:</b> Check-in and check-out dates, guest count, guest name, contact phone, and stay preferences.</li>
                <li><b>Property Listings:</b> Property title, geolocation coordinates, descriptions, room pricing, and photos uploaded via Cloudinary.</li>
                <li><b>Technical & Session Telemetry:</b> HTTP session cookies (<code>connect.sid</code>), IP addresses, and client device headers.</li>
              </ul>
            </div>

            <div className="mb-4">
              <h5 className="fw-bold text-dark mb-2">2. How We Use Your Data</h5>
              <ul className="text-secondary" style={{ lineHeight: '1.8' }}>
                <li>To process instant reservations and enforce atomic double-booking prevention.</li>
                <li>To authenticate property owners and verify tenant authorization boundaries.</li>
                <li>To forward-geocode property addresses into Mapbox GeoJSON coordinates.</li>
                <li>To display guest reviews and ratings on verified stays.</li>
              </ul>
            </div>

            <div className="mb-4">
              <h5 className="fw-bold text-dark mb-2">3. Third-Party Integrations</h5>
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="p-3 bg-light rounded-3 border">
                    <h6 className="fw-bold mb-1"><i className="fa-solid fa-map-pin text-primary me-2"></i>Mapbox GL</h6>
                    <small className="text-muted">Used strictly for forward geocoding and rendering interactive location maps. Your personal user data is never sent to Mapbox.</small>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="p-3 bg-light rounded-3 border">
                    <h6 className="fw-bold mb-1"><i className="fa-solid fa-cloud text-info me-2"></i>Cloudinary</h6>
                    <small className="text-muted">Used to store, optimize, and securely deliver high-resolution property cover and room imagery over a global CDN.</small>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <h5 className="fw-bold text-dark mb-2">4. Tenant Isolation & Data Security</h5>
              <p className="text-secondary" style={{ lineHeight: '1.8' }}>
                WanderLust enforces strict backend tenant isolation. An organization’s internal room inventories, revenue analytics, and upcoming guest check-ins are restricted to authenticated owners and staff within that tenant.
              </p>
            </div>

            <div>
              <h5 className="fw-bold text-dark mb-2">5. Contact Our Privacy Team</h5>
              <p className="text-secondary mb-0" style={{ lineHeight: '1.8' }}>
                If you have questions regarding this Privacy Policy, contact us at <a href="mailto:privacy@wanderlust.com" className="text-danger fw-semibold">privacy@wanderlust.com</a>.
              </p>
            </div>
          </div>

          <div className="text-center mt-4">
            <Link to="/" className="btn btn-outline-secondary rounded-pill px-4 me-2">Back to Explore</Link>
            <Link to="/terms" className="btn btn-danger rounded-pill px-4">View Terms of Service</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;

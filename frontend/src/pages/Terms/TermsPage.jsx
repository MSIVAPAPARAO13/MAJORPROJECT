import React from 'react';
import { Link } from 'react-router-dom';

const TermsPage = () => {
  return (
    <div className="container my-5">
      <div className="row justify-content-center">
        <div className="col-lg-9 col-md-11">
          <div className="mb-4 text-center">
            <span className="badge bg-danger bg-opacity-10 text-danger px-3 py-2 rounded-pill fw-semibold mb-2">User Agreement</span>
            <h1 className="fw-bold mb-2">Terms of Service</h1>
            <p className="text-muted small">Effective Date: September 2026 &bull; Version 2.0</p>
          </div>

          <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white">
            <div className="mb-4 pb-3 border-bottom">
              <h5 className="fw-bold text-dark mb-2"><i className="fa-solid fa-file-contract text-danger me-2"></i>Welcome to WanderLust</h5>
              <p className="text-secondary" style={{ lineHeight: '1.8' }}>
                These Terms of Service ("Terms") govern your access to and use of the <b>WanderLust</b> website, services, APIs, and multi-tenant property management platform. By accessing or using our platform as a traveler, property host, or enterprise manager, you agree to be bound by these Terms.
              </p>
            </div>

            <div className="mb-4">
              <h5 className="fw-bold text-dark mb-2">1. Booking & Reservation Policies</h5>
              <ul className="text-secondary" style={{ lineHeight: '1.8' }}>
                <li><b>Instant Booking Confirmation:</b> Reservations are confirmed atomically in real-time upon checkout. Double-booking conflicts are automatically blocked by the system.</li>
                <li><b>Check-in & Check-out:</b> Standard check-in starts at 2:00 PM local property time, and check-out is by 11:00 AM unless prior arrangements are confirmed with the host.</li>
                <li><b>Cancellation & Refunds:</b> Guests can cancel reservations through their Customer Dashboard. Cancellations made more than 48 hours prior to check-in receive a full refund.</li>
              </ul>
            </div>

            <div className="mb-4">
              <h5 className="fw-bold text-dark mb-2">2. Host & Property Management Rules</h5>
              <ul className="text-secondary" style={{ lineHeight: '1.8' }}>
                <li><b>Accurate Descriptions:</b> Property managers must provide truthful titles, photographs, room capacities, amenities, and geographic coordinates.</li>
                <li><b>Fair Pricing:</b> Base night rates must be transparently declared. Any local taxes (including 18% GST) are calculated dynamically at checkout.</li>
                <li><b>Safety & Standards:</b> All accommodations must comply with local safety, fire, and hospitality regulations.</li>
              </ul>
            </div>

            <div className="mb-4">
              <h5 className="fw-bold text-dark mb-2">3. Multi-Tenant SaaS Responsibilities</h5>
              <p className="text-secondary" style={{ lineHeight: '1.8' }}>
                Organizations operating multiple properties under a tenant profile are responsible for maintaining authorized member roles (<code>OWNER</code>, <code>MANAGER</code>, <code>STAFF</code>). Any unauthorized access attempts across tenant boundaries will result in immediate suspension.
              </p>
            </div>

            <div>
              <h5 className="fw-bold text-dark mb-2">4. Governing Law & Inquiries</h5>
              <p className="text-secondary mb-0" style={{ lineHeight: '1.8' }}>
                These Terms are governed by applicable hospitality and digital commerce regulations. For legal inquiries, contact <a href="mailto:legal@wanderlust.com" className="text-danger fw-semibold">legal@wanderlust.com</a>.
              </p>
            </div>
          </div>

          <div className="text-center mt-4">
            <Link to="/" className="btn btn-outline-secondary rounded-pill px-4 me-2">Back to Explore</Link>
            <Link to="/privacy" className="btn btn-danger rounded-pill px-4">Read Privacy Policy</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;

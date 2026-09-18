import React, { useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';

const TrustPage = () => {
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const element = document.querySelector(hash);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [hash]);

  return (
    <div className="container my-5">
      <div className="row justify-content-center">
        <div className="col-lg-9 col-md-11">
          {/* Header */}
          <div className="mb-5 text-center">
            <span className="badge bg-success bg-opacity-10 text-success px-3 py-2 rounded-pill fw-semibold mb-2">
              Safety & Confidence
            </span>
            <h1 className="fw-bold mb-2">Support & Trust Center</h1>
            <p className="text-muted">
              How WanderLust guarantees safe reservations, verified accommodations, and round-the-clock traveler assistance.
            </p>
          </div>

          {/* Feature 1: Verified Stays Guarantee */}
          <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white mb-4" id="guarantee">
            <div className="d-flex align-items-center gap-3 mb-3">
              <div className="bg-success bg-opacity-10 text-success p-3 rounded-circle">
                <i className="fa-solid fa-shield-check fa-2x"></i>
              </div>
              <div>
                <h4 className="fw-bold mb-0">Verified Stays Guarantee</h4>
                <p className="text-muted small mb-0">Every listing on WanderLust is authenticated.</p>
              </div>
            </div>
            <p className="text-secondary" style={{ lineHeight: '1.8' }}>
              We believe peace of mind is essential for travel. Our Verified Stays program ensures:
            </p>
            <ul className="text-secondary" style={{ lineHeight: '1.8' }}>
              <li><b>Host Authentication:</b> Every property owner and manager undergoes verification before publishing listings.</li>
              <li><b>Geocoding Precision:</b> Locations are validated via Mapbox forward geocoding to ensure properties exist at their indicated addresses.</li>
              <li><b>Genuine Photography:</b> Property imagery is checked against stock stubs to guarantee true visual representation of the rooms and amenities.</li>
              <li><b>No-Surprise Booking:</b> If a property fails to match its description upon check-in, our guest support team re-accommodates you or issues a full refund.</li>
            </ul>
          </div>

          {/* Feature 2: 24/7 Booking Support */}
          <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white mb-4" id="support">
            <div className="d-flex align-items-center gap-3 mb-3">
              <div className="bg-primary bg-opacity-10 text-primary p-3 rounded-circle">
                <i className="fa-solid fa-clock fa-2x"></i>
              </div>
              <div>
                <h4 className="fw-bold mb-0">24/7 Booking & Guest Support</h4>
                <p className="text-muted small mb-0">We are with you before, during, and after your trip.</p>
              </div>
            </div>
            <p className="text-secondary" style={{ lineHeight: '1.8' }}>
              Whether you encounter flight delays, need early check-in assistance, or experience difficulties, our global support network is accessible 24 hours a day, 7 days a week:
            </p>
            <div className="row g-3 my-2">
              <div className="col-md-6">
                <div className="p-3 bg-light rounded-3 border">
                  <h6 className="fw-bold mb-1"><i className="fa-solid fa-envelope text-primary me-2"></i>Email Support</h6>
                  <p className="text-muted small mb-1">Average response time under 15 minutes.</p>
                  <a href="mailto:support@wanderlust.com" className="text-primary fw-bold text-decoration-none">support@wanderlust.com</a>
                </div>
              </div>
              <div className="col-md-6">
                <div className="p-3 bg-light rounded-3 border">
                  <h6 className="fw-bold mb-1"><i className="fa-solid fa-phone text-success me-2"></i>Emergency Hotline</h6>
                  <p className="text-muted small mb-1">Available 24/7 for active stay emergencies.</p>
                  <span className="text-dark fw-bold">+91 1800-WANDERLUST</span>
                </div>
              </div>
            </div>
          </div>

          {/* Feature 3: Secure Payments & Privacy */}
          <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white mb-4" id="security">
            <div className="d-flex align-items-center gap-3 mb-3">
              <div className="bg-danger bg-opacity-10 text-danger p-3 rounded-circle">
                <i className="fa-solid fa-lock fa-2x"></i>
              </div>
              <div>
                <h4 className="fw-bold mb-0">Secure Payments & Privacy</h4>
                <p className="text-muted small mb-0">Bank-grade data encryption and tenant isolation.</p>
              </div>
            </div>
            <p className="text-secondary" style={{ lineHeight: '1.8' }}>
              Your financial transactions and personal reservation records are defended with enterprise security standards:
            </p>
            <ul className="text-secondary" style={{ lineHeight: '1.8' }}>
              <li><b>Strict Tenant Isolation:</b> Customer reservation data is logically isolated and only accessible to the guest and host.</li>
              <li><b>Encrypted Sessions:</b> User authentication and session records are signed and encrypted.</li>
              <li><b>Transparent Pricing:</b> All night rates, durations, and taxes (+18% GST) are computed transparently with no surprise fees.</li>
            </ul>
          </div>

          <div className="text-center mt-4">
            <Link to="/" className="btn btn-danger rounded-pill px-5 shadow-sm">
              Explore Verified Properties
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrustPage;

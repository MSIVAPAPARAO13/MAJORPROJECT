import React from 'react';
import { Link } from 'react-router-dom';

const CATEGORY_FALLBACKS = {
  Boats: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80',
  Hostels: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80',
  Camping: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=800&q=80',
  Arctic: 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?auto=format&fit=crop&w=800&q=80',
  Domes: 'https://images.unsplash.com/photo-1587061949409-02df41d5e562?auto=format&fit=crop&w=800&q=80',
  Mountains: 'https://images.unsplash.com/photo-1502784444187-359ac186c5bb?auto=format&fit=crop&w=800&q=80',
  Rooms: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80',
  Trending: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
  default: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
};

const ListingCard = ({ listing, showTaxes = false }) => {
  const fallback = CATEGORY_FALLBACKS[listing.category] || CATEGORY_FALLBACKS.default;
  const imageUrl = listing.image?.url || fallback;
  const price = Number(listing.price) || 0;
  const priceWithTax = Math.round(price * 1.18);

  return (
    <div className="col">
      <div className="card listing-card h-100 shadow-sm">
        <Link to={`/listings/${listing._id}`} className="text-decoration-none text-dark">
          <div className="position-relative overflow-hidden" style={{ borderRadius: '1rem' }}>
            <img
              src={imageUrl}
              className="card-img-top"
              alt={listing.title}
              style={{ height: '17rem', objectFit: 'cover' }}
              loading="lazy"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = fallback;
              }}
            />
            {listing.category && (
              <span className="position-absolute top-0 end-0 m-3 badge bg-dark bg-opacity-75 text-white rounded-pill px-3 py-1 small">
                {listing.category}
              </span>
            )}
          </div>
          <div className="card-body px-1 py-3">
            <div className="d-flex justify-content-between align-items-baseline mb-1">
              <h6 className="card-title fw-bold mb-0 text-truncate" style={{ maxWidth: '80%' }}>
                {listing.title}
              </h6>
              <span className="small text-muted">
                <i className="fa-solid fa-star text-warning me-1"></i>
                {listing.reviews?.length > 0 ? '4.9' : 'New'}
              </span>
            </div>
            <p className="text-muted small mb-1 text-truncate">
              <i className="fa-solid fa-location-dot text-danger me-1"></i>
              {listing.location}, {listing.country}
            </p>
            <div className="d-flex align-items-baseline gap-1 mt-1">
              <span className="fw-bold fs-6">
                &#8377; {showTaxes ? priceWithTax.toLocaleString('en-IN') : price.toLocaleString('en-IN')}
              </span>
              <span className="text-muted small">/ night</span>
              {showTaxes && <span className="badge bg-light text-secondary border small ms-1">+18% GST</span>}
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default ListingCard;

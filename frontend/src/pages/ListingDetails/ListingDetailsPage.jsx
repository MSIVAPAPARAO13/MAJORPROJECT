import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { listingService } from '../../services/listingService';
import { bookingService } from '../../services/bookingService';
import { useAuth } from '../../context/AuthContext';
import LocationMap from '../../components/Map/LocationMap';

const ListingDetailsPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guestsCount, setGuestsCount] = useState(1);
  const [guestName, setGuestName] = useState(user?.username || '');
  const [guestEmail, setGuestEmail] = useState(user?.email || '');
  const [guestPhone, setGuestPhone] = useState('');
  const [bookingMessage, setBookingMessage] = useState({ type: '', text: '' });
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

  // Review state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchListing();
  }, [id]);

  useEffect(() => {
    if (user) {
      if (!guestName) setGuestName(user.username || '');
      if (!guestEmail) setGuestEmail(user.email || '');
    }
  }, [user]);

  const fetchListing = async () => {
    setLoading(true);
    try {
      const res = await listingService.getById(id);
      if (res.success) {
        setListing(res.data);
        if (res.data.rooms && res.data.rooms.length > 0) {
          setSelectedRoom(res.data.rooms[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load listing:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }
    if (!selectedRoom) {
      setBookingMessage({ type: 'danger', text: 'Please choose an available room.' });
      return;
    }

    setBookingSubmitting(true);
    setBookingMessage({ type: '', text: '' });

    try {
      const res = await bookingService.createBooking({
        roomId: selectedRoom._id,
        checkIn,
        checkOut,
        guestsCount: Number(guestsCount),
        guestName,
        guestEmail,
        guestPhone: guestPhone || '9876543210',
      });

      if (res.success) {
        setBookingMessage({
          type: 'success',
          text: `Reservation confirmed! Total: ₹${res.data?.totalPrice?.toLocaleString('en-IN')}`,
        });
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      }
    } catch (err) {
      setBookingMessage({
        type: 'danger',
        text: err.response?.data?.message || 'Booking failed. Room might be booked for selected dates.',
      });
    } finally {
      setBookingSubmitting(false);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }
    if (!reviewComment.trim()) {
      setReviewMessage({ type: 'danger', text: 'Please enter your review feedback.' });
      return;
    }

    setReviewSubmitting(true);
    setReviewMessage({ type: '', text: '' });

    try {
      const res = await listingService.addReview(id, {
        rating: Number(reviewRating),
        comment: reviewComment.trim(),
      });
      if (res.success) {
        setReviewMessage({ type: 'success', text: 'Thank you! Your review has been submitted.' });
        setReviewComment('');
        setReviewRating(5);
        fetchListing();
      }
    } catch (err) {
      setReviewMessage({
        type: 'danger',
        text: err.response?.data?.message || 'Failed to submit review. Please try again.',
      });
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleReviewDelete = async (reviewId) => {
    if (!window.confirm('Delete this review?')) return;
    try {
      await listingService.deleteReview(id, reviewId);
      fetchListing();
    } catch (err) {
      console.error('Failed to delete review:', err);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-danger" role="status">
          <span className="visually-hidden">Loading property...</span>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="container py-5 text-center">
        <h4>Property not found</h4>
        <Link to="/" className="btn btn-outline-secondary rounded-pill mt-3">Back to Explore</Link>
      </div>
    );
  }

  const imageUrl = listing.image?.url || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80';
  const price = Number(listing.price) || 0;
  const reviewsCount = listing.reviews?.length || 0;
  const avgRating = reviewsCount > 0
    ? (listing.reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0) / reviewsCount).toFixed(1)
    : '4.9';

  return (
    <div className="container my-4 my-md-5">
      {/* Title Header */}
      <div className="mb-3">
        <h2 className="fw-bold mb-1 text-dark">{listing.title}</h2>
        <div className="d-flex flex-wrap align-items-center gap-3 text-muted small">
          <span>
            <i className="fa-solid fa-star text-warning me-1"></i>
            {avgRating} &bull; {reviewsCount} {reviewsCount === 1 ? 'review' : 'reviews'}
          </span>
          <span>
            <i className="fa-solid fa-location-dot text-danger me-1"></i>
            {listing.location}, {listing.country}
          </span>
          {listing.category && (
            <span className="badge bg-light text-dark border rounded-pill">{listing.category}</span>
          )}
          {listing.propertyType && (
            <span className="badge bg-danger bg-opacity-10 text-danger rounded-pill">
              {listing.propertyType}
            </span>
          )}
        </div>
      </div>

      {/* Hero Image */}
      <div className="mb-4 overflow-hidden rounded-4 shadow-sm" style={{ maxHeight: '480px' }}>
        <img
          src={imageUrl}
          alt={listing.title}
          className="w-100 h-100 object-fit-cover"
          style={{ minHeight: '350px' }}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80';
          }}
        />
      </div>

      <div className="row g-5">
        {/* Left Column: Details & Rooms */}
        <div className="col-lg-7">
          <div className="pb-4 border-bottom mb-4">
            <h5 className="fw-bold mb-1">
              Hosted by {listing.owner?.username || 'WanderLust Verified Host'}
            </h5>
            <p className="text-muted small mb-0">
              {listing.organization
                ? `Managed by ${listing.organization.name || 'Hospitality Group'}`
                : 'Dedicated host & verified stay'}
            </p>
          </div>

          <div className="mb-4">
            <h5 className="fw-bold mb-3">About this space</h5>
            <p className="text-secondary" style={{ lineHeight: '1.8', whiteSpace: 'pre-line' }}>
              {listing.description}
            </p>
          </div>

          {/* Amenities & Features */}
          {listing.amenities && listing.amenities.length > 0 && (
            <div className="mb-5 pb-4 border-bottom">
              <h5 className="fw-bold mb-3">
                <i className="fa-solid fa-wand-magic-sparkles text-danger me-2"></i>What this place offers
              </h5>
              <div className="d-flex flex-wrap gap-2">
                {listing.amenities.map((item, idx) => (
                  <span
                    key={idx}
                    className="badge bg-light text-dark border px-3 py-2 rounded-pill fs-6 fw-normal d-inline-flex align-items-center gap-2"
                  >
                    <i className="fa-solid fa-check text-success"></i>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Available Rooms */}
          <div className="mb-5">
            <h5 className="fw-bold mb-3">
              <i className="fa-solid fa-bed text-danger me-2"></i>Available Room Options
            </h5>
            {listing.rooms && listing.rooms.length > 0 ? (
              <div className="list-group rounded-4 shadow-sm">
                {listing.rooms.map((room) => (
                  <label
                    key={room._id}
                    className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center p-3 cursor-pointer ${
                      selectedRoom?._id === room._id ? 'border-danger bg-danger bg-opacity-10' : ''
                    }`}
                    onClick={() => setSelectedRoom(room)}
                  >
                    <div className="d-flex align-items-center gap-3">
                      <input
                        type="radio"
                        name="selectedRoom"
                        className="form-check-input mt-0"
                        checked={selectedRoom?._id === room._id}
                        onChange={() => setSelectedRoom(room)}
                      />
                      <div>
                        <h6 className="fw-bold mb-0">Room {room.roomNumber} &bull; {room.roomType}</h6>
                        <small className="text-muted">Capacity: Up to {room.capacity} Guests</small>
                      </div>
                    </div>
                    <div className="text-end">
                      <span className="fw-bold text-dark">&#8377; {room.price?.toLocaleString('en-IN')}</span>
                      <small className="text-muted d-block">/ night</small>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-light rounded-3 border text-muted small">
                Standard whole-property reservation rate applies.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Reservation Widget */}
        <div className="col-lg-5">
          <div className="card border-0 shadow rounded-4 p-4 sticky-top" style={{ top: '6rem' }}>
            <div className="d-flex justify-content-between align-items-baseline mb-3">
              <div>
                <span className="fs-3 fw-bold text-dark">
                  &#8377; {(selectedRoom?.price || price).toLocaleString('en-IN')}
                </span>
                <span className="text-muted small"> / night</span>
              </div>
              <span className="small text-muted">
                <i className="fa-solid fa-shield-check text-success me-1"></i>Verified Guarantee
              </span>
            </div>

            {bookingMessage.text && (
              <div className={`alert alert-${bookingMessage.type} small py-2 rounded-3`}>
                {bookingMessage.text}
              </div>
            )}

            <form onSubmit={handleBookingSubmit}>
              <div className="border rounded-3 overflow-hidden mb-3">
                <div className="row g-0 border-bottom">
                  <div className="col-6 p-2 border-end">
                    <label className="form-label small fw-bold text-uppercase text-muted m-0" style={{ fontSize: '0.65rem' }}>
                      Check-In
                    </label>
                    <input
                      type="date"
                      className="form-control border-0 p-0 shadow-none small"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-6 p-2">
                    <label className="form-label small fw-bold text-uppercase text-muted m-0" style={{ fontSize: '0.65rem' }}>
                      Check-Out
                    </label>
                    <input
                      type="date"
                      className="form-control border-0 p-0 shadow-none small"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="p-2">
                  <label className="form-label small fw-bold text-uppercase text-muted m-0" style={{ fontSize: '0.65rem' }}>
                    Guests
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={selectedRoom?.capacity || 10}
                    className="form-control border-0 p-0 shadow-none small"
                    value={guestsCount}
                    onChange={(e) => setGuestsCount(e.target.value)}
                  />
                </div>
              </div>

              {!user && (
                <p className="small text-muted text-center mb-3">
                  Please <Link to="/login" className="text-danger fw-semibold">log in</Link> to complete booking.
                </p>
              )}

              <button
                type="submit"
                className="btn btn-danger w-100 py-3 rounded-pill fw-bold shadow-sm mb-3"
                disabled={bookingSubmitting}
              >
                {bookingSubmitting ? 'Securing Stay...' : user ? 'Instant Reserve' : 'Log in to Reserve'}
              </button>
            </form>

            <div className="text-center text-muted small">
              <i className="fa-solid fa-lock text-secondary me-1"></i>You won't be charged yet
            </div>
          </div>
        </div>
      </div>

      {/* Guest Reviews Section */}
      <div className="mt-5 pt-4 border-top">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
          <h4 className="fw-bold mb-0">
            <i className="fa-solid fa-star text-warning me-2"></i>
            {avgRating} &bull; {reviewsCount} {reviewsCount === 1 ? 'Review' : 'Reviews'}
          </h4>
        </div>

        {/* Write a Review Box */}
        <div className="card border-0 bg-light rounded-4 p-4 mb-4 shadow-sm">
          <h6 className="fw-bold mb-2">Share your experience</h6>
          {user ? (
            <form onSubmit={handleReviewSubmit}>
              {reviewMessage.text && (
                <div className={`alert alert-${reviewMessage.type} small py-2 rounded-3`}>
                  {reviewMessage.text}
                </div>
              )}
              <div className="row g-3 mb-3">
                <div className="col-auto">
                  <label className="form-label small fw-semibold mb-1">Rating</label>
                  <select
                    className="form-select form-select-sm rounded-pill"
                    value={reviewRating}
                    onChange={(e) => setReviewRating(e.target.value)}
                  >
                    <option value="5">⭐⭐⭐⭐⭐ (5 - Exceptional)</option>
                    <option value="4">⭐⭐⭐⭐ (4 - Great)</option>
                    <option value="3">⭐⭐⭐ (3 - Average)</option>
                    <option value="2">⭐⭐ (2 - Below expectation)</option>
                    <option value="1">⭐ (1 - Disappointing)</option>
                  </select>
                </div>
                <div className="col-12">
                  <textarea
                    rows="3"
                    className="form-control rounded-3"
                    placeholder="Tell future travelers what you loved about this space, hospitality, and surroundings..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                className="btn btn-dark btn-sm rounded-pill px-4"
                disabled={reviewSubmitting}
              >
                {reviewSubmitting ? 'Posting...' : 'Submit Review'}
              </button>
            </form>
          ) : (
            <p className="text-muted small mb-0">
              <Link to="/login" className="fw-bold text-danger">Log in</Link> to leave a verified guest review.
            </p>
          )}
        </div>

        {/* Existing Reviews Grid */}
        {listing.reviews && listing.reviews.length > 0 ? (
          <div className="row row-cols-1 row-cols-md-2 g-4 mb-5">
            {listing.reviews.map((rev) => (
              <div className="col" key={rev._id}>
                <div className="card h-100 border-0 rounded-4 p-3 shadow-sm bg-white">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <div className="bg-danger bg-opacity-10 text-danger rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: '36px', height: '36px' }}>
                        <i className="fa-solid fa-user"></i>
                      </div>
                      <div>
                        <h6 className="fw-bold mb-0 small text-dark">
                          {rev.author?.username || 'Verified Traveler'}
                        </h6>
                        <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString() : 'Recent Guest'}
                        </small>
                      </div>
                    </div>
                    <div className="text-warning small">
                      {Array.from({ length: rev.rating || 5 }).map((_, i) => (
                        <i key={i} className="fa-solid fa-star"></i>
                      ))}
                    </div>
                  </div>
                  <p className="text-secondary small mb-2">{rev.comment}</p>
                  {user && rev.author && (user._id === rev.author._id || user.role === 'ADMIN') && (
                    <div className="text-end mt-auto">
                      <button
                        onClick={() => handleReviewDelete(rev._id)}
                        className="btn btn-link btn-sm text-danger text-decoration-none p-0 small"
                      >
                        <i className="fa-solid fa-trash me-1"></i>Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted small mb-5">No reviews yet. Be the first to experience this destination!</p>
        )}
      </div>

      {/* Where You'll Be - Location Map Section */}
      <div className="mt-4 pt-4 border-top">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <h4 className="fw-bold mb-1">
              <i className="fa-solid fa-map-location-dot text-danger me-2"></i>
              Where you'll be
            </h4>
            <p className="text-muted small mb-0">
              <i className="fa-solid fa-location-dot text-danger me-1"></i>
              {listing.location}, {listing.country}
            </p>
          </div>
          <span className="badge bg-light text-secondary border px-3 py-2 rounded-pill small">
            <i className="fa-solid fa-compass text-danger me-1"></i> Interactive Mapbox View
          </span>
        </div>

        {/* Location Map Interactive Component */}
        <LocationMap listing={listing} />
      </div>
    </div>
  );
};

export default ListingDetailsPage;

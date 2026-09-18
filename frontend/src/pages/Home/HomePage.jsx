import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import CategoryFilter from '../../components/CategoryFilter/CategoryFilter';
import ListingCard from '../../components/ListingCard/ListingCard';
import { listingService } from '../../services/listingService';

const HomePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTaxes, setShowTaxes] = useState(false);

  const categoryParam = searchParams.get('category') || 'All';
  const queryParam = searchParams.get('q') || '';

  useEffect(() => {
    fetchListings();
  }, [categoryParam, queryParam]);

  const fetchListings = async () => {
    setLoading(true);
    try {
      const params = {};
      if (categoryParam !== 'All') params.category = categoryParam;
      if (queryParam) params.q = queryParam;

      const res = await listingService.getAll(params);
      if (res.success) {
        setListings(res.data);
      }
    } catch (err) {
      console.error('Failed to load listings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCategory = (catId) => {
    const nextParams = new URLSearchParams(searchParams);
    if (catId === 'All') {
      nextParams.delete('category');
    } else {
      nextParams.set('category', catId);
    }
    setSearchParams(nextParams);
  };

  return (
    <div className="container pb-5">
      {/* Category Bar */}
      <CategoryFilter
        selectedCategory={categoryParam}
        onSelectCategory={handleSelectCategory}
        showTaxes={showTaxes}
        onToggleTaxes={() => setShowTaxes(!showTaxes)}
      />

      {/* Query indicator */}
      {queryParam && (
        <div className="alert alert-light border rounded-pill d-flex align-items-center justify-content-between px-4 py-2 mb-4">
          <span className="small text-muted">
            Showing stays matching: <b>"{queryParam}"</b>
          </span>
          <button
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete('q');
              setSearchParams(next);
            }}
            className="btn btn-sm btn-link text-danger text-decoration-none p-0 fw-semibold"
          >
            Clear Search
          </button>
        </div>
      )}

      {/* Grid or Loading */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-danger" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted small mt-3">Discovering curated stays...</p>
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-5">
          <div className="bg-light d-inline-block p-4 rounded-circle mb-3">
            <i className="fa-solid fa-hotel fa-3x text-muted opacity-50"></i>
          </div>
          <h4 className="fw-bold">No stays found</h4>
          <p className="text-muted small mb-4">
            Try adjusting your search query or explore a different stay category.
          </p>
          <button
            onClick={() => setSearchParams({})}
            className="btn btn-danger rounded-pill px-4 shadow-sm"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="row row-cols-xxl-4 row-cols-lg-3 row-cols-md-2 row-cols-1 g-4">
          {listings.map((listing) => (
            <ListingCard key={listing._id} listing={listing} showTaxes={showTaxes} />
          ))}
        </div>
      )}
    </div>
  );
};

export default HomePage;

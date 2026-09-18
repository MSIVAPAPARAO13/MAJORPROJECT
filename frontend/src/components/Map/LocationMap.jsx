import React, { useEffect, useRef } from 'react';

const LocationMap = ({ listing }) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // Validate coordinates: [lng, lat]
  let coords = null;
  if (
    listing &&
    listing.geometry &&
    Array.isArray(listing.geometry.coordinates) &&
    listing.geometry.coordinates.length === 2
  ) {
    const [lng, lat] = listing.geometry.coordinates;
    if (
      typeof lng === 'number' &&
      !isNaN(lng) &&
      lng >= -180 &&
      lng <= 180 &&
      typeof lat === 'number' &&
      !isNaN(lat) &&
      lat >= -90 &&
      lat <= 90 &&
      !(lng === 0 && lat === 0)
    ) {
      coords = [lng, lat];
    }
  }

  useEffect(() => {
    if (!coords || !mapContainerRef.current) return;

    const token = import.meta.env.VITE_MAP_TOKEN || window.mapToken || '';
    if (!token || !window.mapboxgl) return;

    try {
      window.mapboxgl.accessToken = token;

      const map = new window.mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: coords,
        zoom: 12,
        cooperativeGestures: true,
      });

      mapInstanceRef.current = map;

      // Add navigation controls (zoom, compass)
      map.addControl(new window.mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');

      // Popup with styled property preview
      const priceDisplay = listing?.price
        ? `₹${Number(listing.price).toLocaleString('en-IN')} / night`
        : '';
      const popupHtml = `
        <div style="padding: 6px 4px; font-family: 'Plus Jakarta Sans', sans-serif;">
          <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: #1e293b;">
            ${listing?.title || 'Property'}
          </div>
          <div style="font-size: 12px; color: #64748b; margin-bottom: 6px;">
            <i class="fa-solid fa-location-dot" style="color: #fe424d; margin-right: 4px;"></i>
            ${listing?.location || ''}, ${listing?.country || ''}
          </div>
          ${priceDisplay ? `<span style="background: #fe424d; color: white; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600;">${priceDisplay}</span>` : ''}
        </div>
      `;

      const popup = new window.mapboxgl.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: false,
      }).setHTML(popupHtml);

      // Marker at coordinates
      const marker = new window.mapboxgl.Marker({ color: '#fe424d' })
        .setLngLat(coords)
        .setPopup(popup)
        .addTo(map);

      // Open popup by default after map loads
      map.on('load', () => {
        marker.togglePopup();
      });

      return () => {
        map.remove();
      };
    } catch (err) {
      console.error('Failed to initialize Mapbox:', err);
    }
  }, [listing, coords?.[0], coords?.[1]]);

  if (!coords) {
    return (
      <div className="card border-0 rounded-4 bg-light p-4 text-center shadow-sm">
        <div className="mb-3">
          <span
            className="d-inline-flex align-items-center justify-content-center bg-danger bg-opacity-10 text-danger rounded-circle"
            style={{ width: '56px', height: '56px' }}
          >
            <i className="fa-solid fa-location-dot fa-xl"></i>
          </span>
        </div>
        <h6 className="fw-bold mb-1 text-dark">Exact Location on Map Unavailable</h6>
        <p className="text-muted small mb-0 mx-auto" style={{ maxWidth: '500px' }}>
          <strong>Address:</strong> {listing?.location || 'Location on file'}, {listing?.country || ''}. Exact directions, coordinates, and check-in instructions are shared upon reservation confirmation.
        </p>
      </div>
    );
  }

  return (
    <div className="position-relative overflow-hidden rounded-4 border shadow-sm" style={{ height: '420px', width: '100%' }}>
      <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
      <div
        className="position-absolute bottom-0 start-0 m-3 px-3 py-2 bg-white bg-opacity-95 rounded-pill shadow-sm border small d-none d-sm-flex align-items-center gap-2"
        style={{ zIndex: 1, backdropFilter: 'blur(8px)' }}
      >
        <i className="fa-solid fa-crosshairs text-danger"></i>
        <span className="fw-semibold text-dark">{listing?.location}, {listing?.country}</span>
      </div>
    </div>
  );
};

export default LocationMap;

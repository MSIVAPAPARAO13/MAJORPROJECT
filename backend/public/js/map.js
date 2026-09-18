// Mapbox GL JS map renderer for property show page

(function () {
  const mapContainer = document.getElementById("map");
  if (!mapContainer) return;

  // Validate token
  const token = typeof mapToken !== "undefined" && mapToken ? mapToken : null;
  if (!token) {
    mapContainer.innerHTML = '<div class="alert alert-secondary text-center p-4">Map service is currently unavailable.</div>';
    return;
  }

  // Validate coordinates
  let coords = null;
  if (
    typeof listing !== "undefined" &&
    listing &&
    listing.geometry &&
    Array.isArray(listing.geometry.coordinates) &&
    listing.geometry.coordinates.length === 2
  ) {
    const [lng, lat] = listing.geometry.coordinates;
    if (
      typeof lng === "number" && !isNaN(lng) && lng >= -180 && lng <= 180 &&
      typeof lat === "number" && !isNaN(lat) && lat >= -90 && lat <= 90 &&
      !(lng === 0 && lat === 0)
    ) {
      coords = [lng, lat];
    }
  }

  if (!coords) {
    mapContainer.innerHTML = `
      <div class="card p-4 text-center bg-light border-0 shadow-sm">
        <div class="mb-2"><i class="fa-solid fa-location-dot text-danger fa-2x"></i></div>
        <h6 class="fw-bold mb-1">Exact Location Unavailable on Map</h6>
        <p class="text-muted small mb-0">Address: ${listing && listing.location ? listing.location : "Location on file"}, ${listing && listing.country ? listing.country : ""}. Exact directions and coordinates will be provided after booking.</p>
      </div>
    `;
    return;
  }

  try {
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/streets-v12",
      center: coords,
      zoom: 11
    });

    // Add navigation controls (zoom in/out, compass)
    map.addControl(new mapboxgl.NavigationControl());

    // Popup with property details
    const priceDisplay = listing.price ? `₹${Number(listing.price).toLocaleString("en-IN")} / night` : "";
    const popupContent = `
      <div class="p-1">
        <h6 class="fw-bold mb-1 text-dark">${listing.title}</h6>
        <p class="text-muted small mb-1"><i class="fa-solid fa-location-dot text-danger"></i> ${listing.location}, ${listing.country}</p>
        <span class="badge bg-danger text-white">${priceDisplay}</span>
      </div>
    `;

    const popup = new mapboxgl.Popup({ offset: 25, closeButton: false })
      .setHTML(popupContent);

    // Marker placed strictly at [longitude, latitude]
    new mapboxgl.Marker({ color: "#fe424d" })
      .setLngLat(coords)
      .setPopup(popup)
      .addTo(map);

  } catch (err) {
    console.error("Failed to render Mapbox map:", err);
    mapContainer.innerHTML = '<div class="alert alert-secondary text-center p-3">Unable to display map at this time.</div>';
  }
})();
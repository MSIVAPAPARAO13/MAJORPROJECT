const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapboxToken = process.env.MAP_TOKEN;

let geocodingClient = null;
if (mapboxToken) {
  try {
    geocodingClient = mbxGeocoding({ accessToken: mapboxToken });
  } catch (err) {
    console.error("Failed to initialize Mapbox client:", err.message);
  }
}

// Geocode an address/location string to GeoJSON coordinates [longitude, latitude]
async function geocodeLocation(locationString, countryString = "") {
  const query = countryString ? `${locationString}, ${countryString}` : locationString;
  
  // Default coordinates (e.g. New Delhi: 77.2090, 28.6139) if geocoding is unavailable
  const fallbackCoords = [77.2090, 28.6139];

  if (!geocodingClient || !mapboxToken || !locationString) {
    return {
      type: "Point",
      coordinates: fallbackCoords,
      isFallback: true
    };
  }

  try {
    const response = await geocodingClient
      .forwardGeocode({
        query: query.trim(),
        limit: 1
      })
      .send();

    if (
      response &&
      response.body &&
      response.body.features &&
      response.body.features.length > 0 &&
      response.body.features[0].geometry &&
      Array.isArray(response.body.features[0].geometry.coordinates) &&
      response.body.features[0].geometry.coordinates.length === 2
    ) {
      const [lng, lat] = response.body.features[0].geometry.coordinates;
      // Validate bounds
      if (lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90) {
        return {
          type: "Point",
          coordinates: [lng, lat],
          isFallback: false
        };
      }
    }
  } catch (err) {
    console.error(`Mapbox geocoding error for query "${query}":`, err.message);
  }

  return {
    type: "Point",
    coordinates: fallbackCoords,
    isFallback: true
  };
}

module.exports = {
  geocodeLocation
};

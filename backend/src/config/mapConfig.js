const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");

const mapboxToken = process.env.MAP_TOKEN || process.env.MAPBOX_TOKEN;

let geocodingClient = null;

if (mapboxToken) {
  try {
    geocodingClient = mbxGeocoding({ accessToken: mapboxToken });
  } catch (err) {
    console.error("[Mapbox Config Error]: Failed to initialize Mapbox client:", err.message);
  }
}

module.exports = {
  mapboxToken,
  geocodingClient
};

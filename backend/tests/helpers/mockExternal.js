/**
 * Phase 11 External Service Mocks
 * Provides deterministic, network-free mocks for Cloudinary and Mapbox Geocoding.
 */

const mockCloudinary = {
  v2: {
    uploader: {
      upload: async (file, options = {}) => {
        const publicId = options.public_id || `wanderlust_DEV/mock_${Date.now()}`;
        return {
          public_id: publicId,
          secure_url: `https://res.cloudinary.com/mock-cloud/image/upload/v1234567890/${publicId}.jpg`,
          format: "jpg",
          width: 1200,
          height: 800,
          resource_type: "image"
        };
      },
      destroy: async (publicId, options = {}) => {
        return {
          result: "ok"
        };
      }
    }
  }
};

const mockMapbox = {
  geocoding: () => ({
    forwardGeocode: (config) => ({
      send: async () => ({
        body: {
          features: [
            {
              geometry: {
                type: "Point",
                coordinates: [77.2090, 28.6139] // Deterministic coordinates (New Delhi)
              },
              place_name: config.query || "New Delhi, India"
            }
          ]
        }
      })
    })
  })
};

module.exports = {
  mockCloudinary,
  mockMapbox
};

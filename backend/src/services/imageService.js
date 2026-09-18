// Service for managing property images, Cloudinary uploads, and fallbacks

const DEFAULT_IMAGE_FALLBACK = "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80";

function processUploadedImage(file) {
  if (file && file.path) {
    return {
      url: file.path,
      filename: file.filename || "property_image"
    };
  }
  return {
    url: DEFAULT_IMAGE_FALLBACK,
    filename: "default_fallback"
  };
}

function processMultipleImages(files) {
  if (!files || files.length === 0) {
    return [
      {
        url: DEFAULT_IMAGE_FALLBACK,
        filename: "default_fallback",
        isPrimary: true
      }
    ];
  }

  return files.map((file, idx) => ({
    url: file.path,
    filename: file.filename || `property_image_${idx}`,
    isPrimary: idx === 0
  }));
}

module.exports = {
  processUploadedImage,
  processMultipleImages,
  DEFAULT_IMAGE_FALLBACK
};

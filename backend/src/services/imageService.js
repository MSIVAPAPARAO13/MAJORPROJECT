// Service for managing property images, Cloudinary uploads, normalization, and safe media lifecycle
const { cloudinary } = require("../config/cloudConfig");

const DEFAULT_IMAGE_FALLBACK = "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80";

// Check if a string is a genuine Cloudinary public ID (never a legacy dummy filename or external URL)
function isGenuineCloudinaryPublicId(publicId) {
  if (!publicId || typeof publicId !== "string") return false;
  const trimmed = publicId.trim();
  if (!trimmed) return false;
  
  // Exclude legacy seed filenames and non-Cloudinary dummies
  const disallowed = ["listingimage", "default_fallback", "property_image"];
  if (disallowed.includes(trimmed.toLowerCase())) {
    return false;
  }

  // Reject URLs or external hosts
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return false;
  }

  // Reject directory traversal
  if (trimmed.includes("..")) {
    return false;
  }

  return true;
}

// Safely extract public ID from a Cloudinary URL
function extractPublicIdFromUrl(url) {
  if (!url || typeof url !== "string" || !url.includes("cloudinary.com")) {
    return null;
  }
  try {
    const uploadIndex = url.indexOf("/upload/");
    if (uploadIndex === -1) return null;
    let pathAfterUpload = url.substring(uploadIndex + 8);
    // Strip version prefix if present e.g. v1234567890/
    pathAfterUpload = pathAfterUpload.replace(/^v\d+\//, "");
    // Remove query params if any
    const queryIdx = pathAfterUpload.indexOf("?");
    if (queryIdx !== -1) {
      pathAfterUpload = pathAfterUpload.substring(0, queryIdx);
    }
    // Remove extension
    const lastDotIndex = pathAfterUpload.lastIndexOf(".");
    if (lastDotIndex !== -1) {
      pathAfterUpload = pathAfterUpload.substring(0, lastDotIndex);
    }
    return isGenuineCloudinaryPublicId(pathAfterUpload) ? pathAfterUpload : null;
  } catch (e) {
    return null;
  }
}

// Determine whether an image subdocument is a Cloudinary asset
function isCloudinaryAsset(image) {
  if (!image) return false;
  if (typeof image.url === "string" && (image.url.includes("res.cloudinary.com") || image.url.includes("cloudinary.com"))) {
    return true;
  }
  if (image.publicId && isGenuineCloudinaryPublicId(image.publicId)) {
    return true;
  }
  return false;
}

// Safely delete a Cloudinary asset
// Consistency boundary: If Cloudinary fails or is offline, logs warning and returns safely.
// Never deletes based on raw unverified user-supplied filenames or external Unsplash images.
async function deleteCloudinaryAsset(imageOrPublicId) {
  let publicId = null;

  if (typeof imageOrPublicId === "string") {
    if (isGenuineCloudinaryPublicId(imageOrPublicId)) {
      publicId = imageOrPublicId.trim();
    }
  } else if (imageOrPublicId && typeof imageOrPublicId === "object") {
    if (imageOrPublicId.publicId && isGenuineCloudinaryPublicId(imageOrPublicId.publicId)) {
      publicId = imageOrPublicId.publicId.trim();
    } else if (imageOrPublicId.url && isCloudinaryAsset(imageOrPublicId)) {
      publicId = extractPublicIdFromUrl(imageOrPublicId.url);
    }
  }

  if (!publicId) {
    return { success: false, skipped: true, reason: "not_a_cloudinary_asset" };
  }

  try {
    if (cloudinary && cloudinary.uploader && typeof cloudinary.uploader.destroy === "function") {
      const result = await cloudinary.uploader.destroy(publicId);
      return { success: true, result };
    }
  } catch (err) {
    console.warn(`[Cloudinary Warning] Could not destroy asset "${publicId}": ${err.message}`);
    return { success: false, error: err.message };
  }

  return { success: false, reason: "cloudinary_not_configured" };
}

// Process a single file uploaded via Multer
function processUploadedImage(file, index = 0) {
  if (!file || !file.path) {
    return {
      url: DEFAULT_IMAGE_FALLBACK,
      filename: "default_fallback",
      publicId: "",
      alt: "Default property image",
      position: index,
      isPrimary: index === 0
    };
  }

  const isCloud = typeof file.path === "string" && (file.path.includes("cloudinary.com") || file.path.includes("res.cloudinary.com"));
  let publicId = "";
  if (isCloud) {
    if (file.filename && isGenuineCloudinaryPublicId(file.filename)) {
      publicId = file.filename;
    } else {
      publicId = extractPublicIdFromUrl(file.path) || "";
    }
  }

  return {
    url: file.path,
    filename: file.filename || `property_image_${index}`,
    publicId,
    alt: file.originalname ? file.originalname.split(".")[0] : `Property image ${index + 1}`,
    position: index,
    isPrimary: index === 0
  };
}

// Process multiple files uploaded via Multer
function processMultipleUploadedImages(files, startIndex = 0) {
  if (!files || !Array.isArray(files) || files.length === 0) {
    return [];
  }
  return files.map((file, idx) => processUploadedImage(file, startIndex + idx));
}

// Backward-compatible wrapper
function processMultipleImages(files) {
  if (!files || files.length === 0) {
    return [
      {
        url: DEFAULT_IMAGE_FALLBACK,
        filename: "default_fallback",
        publicId: "",
        alt: "Default property image",
        position: 0,
        isPrimary: true
      }
    ];
  }
  return files.map((file, idx) => processUploadedImage(file, idx));
}

// Normalizes an array of listing images:
// 1. Preserves all existing images
// 2. Normalizes positions (0, 1, 2, ...)
// 3. Guarantees exactly ONE primary image (deterministic selection)
// 4. Returns normalized images and primaryImage mirror object
function normalizeListingImages(images, options = {}) {
  if (!Array.isArray(images) || images.length === 0) {
    return {
      images: [],
      primaryImage: null
    };
  }

  const preserveOrder = Boolean(options.preserveOrder);

  // Sort by position if available, preserving relative order otherwise (unless preserveOrder is requested)
  const cloned = images.map((img, originalIndex) => {
    const raw = typeof img.toObject === "function" ? img.toObject() : { ...img };
    return {
      ...raw,
      _originalIndex: originalIndex,
      position: typeof raw.position === "number" ? raw.position : originalIndex
    };
  });

  if (!preserveOrder) {
    cloned.sort((a, b) => {
      if (a.position !== b.position) {
        return a.position - b.position;
      }
      return a._originalIndex - b._originalIndex;
    });
  }

  // Find all primary flags
  const primaryIndices = [];
  cloned.forEach((item, idx) => {
    if (item.isPrimary) {
      primaryIndices.push(idx);
    }
  });

  // If multiple primaries exist, keep the first one
  // If no primary exists, select position 0 deterministically
  const chosenPrimaryIdx = primaryIndices.length > 0 ? primaryIndices[0] : 0;

  const normalized = cloned.map((item, idx) => {
    const { _originalIndex, ...cleanItem } = item;
    cleanItem.position = idx;
    cleanItem.isPrimary = (idx === chosenPrimaryIdx);
    return cleanItem;
  });

  const primaryObj = normalized[chosenPrimaryIdx] || normalized[0] || null;
  const primaryImage = primaryObj ? {
    url: primaryObj.url,
    filename: primaryObj.filename || ""
  } : null;

  return {
    images: normalized,
    primaryImage
  };
}

// Generates dynamic thumbnail URLs
function getThumbnailUrl(imageUrl, width = 250) {
  if (!imageUrl || typeof imageUrl !== "string") {
    return "";
  }
  if (imageUrl.includes("/upload/")) {
    return imageUrl.replace("/upload/", `/upload/w_${width},c_fill/`);
  }
  if (imageUrl.includes("images.unsplash.com")) {
    return imageUrl.replace(/w=\d+/, `w=${width}`);
  }
  return imageUrl;
}

module.exports = {
  DEFAULT_IMAGE_FALLBACK,
  isGenuineCloudinaryPublicId,
  isCloudinaryAsset,
  extractPublicIdFromUrl,
  deleteCloudinaryAsset,
  processUploadedImage,
  processMultipleUploadedImages,
  processMultipleImages,
  normalizeListingImages,
  getThumbnailUrl
};

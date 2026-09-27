const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const RefreshToken = require("../models/refreshToken");
const User = require("../models/user");

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.SECRET || "wanderlust_jwt_access_secret_production_fallback";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "wanderlust_jwt_refresh_secret_production_fallback";

const ACCESS_TOKEN_EXPIRES_IN = "15m";
const REFRESH_TOKEN_DAYS = 7;

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Generate a short-lived cryptographically signed Access Token (15 mins)
 */
function generateAccessToken(user) {
  const payload = {
    sub: user._id.toString(),
    role: user.role,
    organizationId: user.organization ? user.organization.toString() : null,
    jti: crypto.randomUUID()
  };

  return jwt.sign(payload, JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN
  });
}

/**
 * Generate and persist an opaque Refresh Token with Token Family tracking (7 days)
 */
async function generateRefreshToken(user, familyId = null) {
  const rawToken = crypto.randomBytes(40).toString("hex");
  const tokenHash = hashToken(rawToken);
  const activeFamilyId = familyId || crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    user: user._id,
    tokenHash,
    familyId: activeFamilyId,
    expiresAt,
    createdAt: new Date(),
    lastUsedAt: new Date()
  });

  return {
    rawToken,
    expiresAt,
    familyId: activeFamilyId
  };
}

/**
 * Verify Access Token signature and expiration
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_ACCESS_SECRET);
  } catch (err) {
    throw err;
  }
}

/**
 * Rotate Refresh Token with Automatic Reuse Detection
 */
async function rotateRefreshToken(rawToken) {
  if (!rawToken || typeof rawToken !== "string") {
    const error = new Error("Refresh token is required");
    error.statusCode = 400;
    throw error;
  }

  const tokenHash = hashToken(rawToken);
  const existingToken = await RefreshToken.findOne({ tokenHash });

  if (!existingToken) {
    const error = new Error("Invalid or unrecognized refresh token");
    error.statusCode = 401;
    throw error;
  }

  // Token Reuse Detection: If an already-revoked token is presented, someone may be attempting a replay attack.
  // Invalidate ALL tokens in this family immediately.
  if (existingToken.revokedAt) {
    await RefreshToken.updateMany(
      { familyId: existingToken.familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    const error = new Error("Refresh token reuse detected. All sessions in this family have been revoked.");
    error.statusCode = 403;
    throw error;
  }

  // Check expiration
  if (existingToken.expiresAt < new Date()) {
    existingToken.revokedAt = new Date();
    await existingToken.save();
    const error = new Error("Refresh token has expired");
    error.statusCode = 401;
    throw error;
  }

  // Fetch associated user
  const user = await User.findById(existingToken.user);
  if (!user) {
    const error = new Error("User associated with refresh token no longer exists");
    error.statusCode = 401;
    throw error;
  }

  // Generate new refresh token in the same family
  const newRawToken = crypto.randomBytes(40).toString("hex");
  const newTokenHash = hashToken(newRawToken);
  const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  // Mark old token as revoked and replaced
  existingToken.revokedAt = new Date();
  existingToken.replacedBy = newTokenHash;
  existingToken.lastUsedAt = new Date();
  await existingToken.save();

  // Create new active token record
  await RefreshToken.create({
    user: user._id,
    tokenHash: newTokenHash,
    familyId: existingToken.familyId,
    expiresAt: newExpiresAt,
    createdAt: new Date(),
    lastUsedAt: new Date()
  });

  const newAccessToken = generateAccessToken(user);

  return {
    accessToken: newAccessToken,
    refreshToken: newRawToken,
    expiresAt: newExpiresAt,
    user: {
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      organization: user.organization
    }
  };
}

/**
 * Revoke a refresh token on logout
 */
async function revokeRefreshToken(rawToken) {
  if (!rawToken) return false;
  const tokenHash = hashToken(rawToken);
  const result = await RefreshToken.updateOne(
    { tokenHash, revokedAt: null },
    { $set: { revokedAt: new Date(), lastUsedAt: new Date() } }
  );
  return result.modifiedCount > 0;
}

/**
 * Standard cookie configuration for refresh tokens
 */
function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/v2/auth",
    maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
  };
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  rotateRefreshToken,
  revokeRefreshToken,
  getRefreshCookieOptions,
  hashToken
};

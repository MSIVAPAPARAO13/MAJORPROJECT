const mongoose = require("mongoose");
const { Schema } = mongoose;

const refreshTokenSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    familyId: {
      type: String,
      required: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    revokedAt: {
      type: Date,
      default: null
    },
    replacedBy: {
      type: String,
      default: null
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastUsedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Compound index for user query filtering
refreshTokenSchema.index({ user: 1, revokedAt: 1 });

// TTL index to automatically purge expired refresh tokens from database
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("RefreshToken", refreshTokenSchema);

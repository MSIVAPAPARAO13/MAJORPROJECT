const mongoose = require("mongoose");
const { Schema } = mongoose;

const userPreferenceSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
    },
    theme: {
      type: String,
      enum: ["light", "dark", "system"],
      default: "light"
    },
    density: {
      type: String,
      enum: ["comfortable", "compact"],
      default: "comfortable"
    },
    sidebarState: {
      type: String,
      enum: ["expanded", "collapsed"],
      default: "expanded"
    },
    dashboardLayout: {
      type: Schema.Types.Mixed,
      default: () => ({})
    },
    notifications: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserPreference", userPreferenceSchema);

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const serviceIssueSchema = new Schema({
  property: {
    type: Schema.Types.ObjectId,
    ref: "Listing",
    required: true,
    index: true
  },
  room: {
    type: Schema.Types.ObjectId,
    ref: "Room",
    required: true,
    index: true
  },
  organization: {
    type: Schema.Types.ObjectId,
    ref: "Organization",
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  priority: {
    type: String,
    enum: ["LOW", "MEDIUM", "HIGH"],
    default: "MEDIUM",
    index: true
  },
  status: {
    type: String,
    enum: ["REPORTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"],
    default: "REPORTED",
    index: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: "User"
  },
  resolvedAt: {
    type: Date
  }
}, { timestamps: true });

// Compound indexes for tenant-scoped operations, room-level lookups, and property-level filtering
serviceIssueSchema.index({ organization: 1, status: 1 });
serviceIssueSchema.index({ room: 1, status: 1 });
serviceIssueSchema.index({ property: 1, status: 1 });

const ServiceIssue = mongoose.model("ServiceIssue", serviceIssueSchema);
module.exports = ServiceIssue;

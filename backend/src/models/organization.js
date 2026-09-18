const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const organizationSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  members: [
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: "User"
      },
      role: {
        type: String,
        enum: ["OWNER", "MANAGER", "STAFF"],
        default: "STAFF"
      }
    }
  ],
  contactEmail: {
    type: String,
    trim: true
  },
  phone: {
    type: String
  },
  address: {
    type: String
  },
  logo: {
    type: String
  }
}, { timestamps: true });

const Organization = mongoose.model("Organization", organizationSchema);
module.exports = Organization;

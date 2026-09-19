const Organization = require("../models/organization");
const Listing = require("../models/listing");
require("../models/user");
const ExpressError = require("../utils/ExpressError");

// Create organization and assign owner
async function createOrganization(orgData, ownerUser) {
  const { name, description, contactEmail, phone, address } = orgData;

  const organization = new Organization({
    name: name.trim(),
    description,
    owner: ownerUser._id,
    members: [{ user: ownerUser._id, role: "OWNER" }],
    contactEmail: contactEmail || ownerUser.email,
    phone,
    address
  });

  await organization.save();

  // Update user role to OWNER and attach organization
  ownerUser.role = "OWNER";
  ownerUser.organization = organization._id;
  await ownerUser.save();

  return organization;
}

// Get organization by ID
async function getOrganizationById(orgId) {
  const org = await Organization.findById(orgId).populate("owner").populate("members.user");
  if (!org) {
    throw new ExpressError("Organization not found", 404);
  }
  return org;
}

// Get listings belonging to an organization
async function getOrganizationListings(orgId) {
  return await Listing.find({ organization: orgId }).sort({ createdAt: -1 });
}

module.exports = {
  createOrganization,
  getOrganizationById,
  getOrganizationListings
};

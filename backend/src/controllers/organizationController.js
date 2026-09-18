const organizationService = require("../services/organizationService");
const Listing = require("../models/listing");

module.exports.renderNewForm = (req, res) => {
  res.render("organizations/new.ejs");
};

module.exports.createOrganization = async (req, res) => {
  const organization = await organizationService.createOrganization(req.body.organization, req.user);
  req.flash("success", `Organization "${organization.name}" registered successfully!`);
  res.redirect("/dashboard");
};

module.exports.showOrganization = async (req, res) => {
  const { orgId } = req.params;
  const organization = await organizationService.getOrganizationById(orgId);
  const properties = await Listing.find({ organization: orgId });
  res.render("organizations/show.ejs", { organization, properties });
};

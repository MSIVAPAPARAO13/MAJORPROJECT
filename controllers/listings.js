const Listing = require("../models/listing");
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapboxToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapboxToken });

module.exports.index = async (req, res) => {
const allListings = await Listing.find({});
  res.render("listings/index.ejs", { allListings });
};

module.exports.renderNewForm = (req, res) => {
  res.render("listings/new.ejs");
};
  module.exports.showListing = async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id)
  .populate({path:"reviews", populate:{path:"author"}})
  .populate("owner");
  if(!listing){
    req.flash("error","listing you requested for does not exist");
    return res.redirect("/listings");
  }
  console.log(listing);
  res.render("listings/show.ejs", { listing });
};

module.exports.createListing = async (req, res, next) => {
  let response=await geocodingClient.forwardGeocode({
  query: req.body.listing.location,
  limit: 1,
})
  .send();

  let url= req.file.path;
  let filename= req.file.filename;
  console.log(url,"..", filename);
  const newListing = new Listing(req.body.listing);
  newListing.owner = req.user._id;
  newListing.image = { url, filename };
  newListing.geometry = response.body.features[0].geometry;
   let savedListing = await newListing.save();
   console.log(savedListing);
  req.flash("success","New Listing Created!");
  res.redirect("/listings");
};

module.exports.renderEditForm = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);
  if(!listing){
    req.flash("error","listing you requested for does not exist");
    return res.redirect("/listings");
  }
   let originalImageUrl = listing.image.url;
  originalImageUrl =originalImageUrl.replace("/upload", "/upload/w_250");
  res.render("listings/edit.ejs", { listing, originalImageUrl });
};

module.exports.updateListing = async (req, res) => {
  let { id } = req.params;
  let listing= await Listing.findByIdAndUpdate(id, { ...req.body.listing });
  if (req.file) { 
  let url= req.file.path;
 let filename= req.file.filename;
 listing.image = { url, filename };
  await listing.save();
}
  req.flash("success", "Listing Updated!");
  res.redirect(`/listings/${id}`);
};

module.exports.destroyListing = async (req, res) => {
  const { id } = req.params;
  
  let deletedListing = await Listing.findByIdAndDelete(id);
  
  if (!deletedListing) {
    return res.status(404).send("Listing not found");
  }

  console.log(deletedListing);
  req.flash("success", "Listing Deleted!");
  res.redirect("/listings");
};
const Listing = require("./models/listing");
const Review = require("./models/review");
const { listingSchema,reviewSchema} = require("./schema.js");
const ExpressError = require("./utils/ExpressError.js");

module.exports.isLoggedIn = (req, res, next) => {
    console.log(req.path,"..",req.originalUrl);
  if (!req.isAuthenticated()) {
    req.session.redirectUrl = req.originalUrl; // Store the original URL
    req.flash("error", "You must be logged in to do that");
    return res.redirect("/login");
  }
  next();
}
module.exports.saveRedirectUrl = (req, res, next) => {
   if(req.session.redirectUrl) {
      res.locals.redirectUrl = req.session.redirectUrl; // Make it available in the response locals
}
  next();
}
module.exports.isOwner = async (req, res, next) => {
   let { id } = req.params;
    let listing = await Listing.findById(id);
  if (!listing.owner._id.equals(req.user._id)) {
      req.flash("error", "You are not the owner of this listing");
      return res.redirect(`/listings/${id}`);
    }
    next();
};
module.exports.validateListing = (req, res, next) => {
  let { error } = listingSchema.validate(req.body);
 if (error) {
    let errorMessage = error.details.map((el) => el.message).join(", ");
    throw new ExpressError(errorMessage, 400);
  } else {
    next();
  }
};

module.exports.validateReview = (req, res, next) => {
    let { error } = reviewSchema.validate(req.body);
    if (error) {
      let errorMessage = error.details.map((el) => el.message).join(", ");
      throw new ExpressError(errorMessage, 400);
    } else {
      next();
    }
  };
  module.exports.isReviewAuthor = async (req, res, next) => {
   let { id, reviewId } = req.params;
    let review = await Review.findById(reviewId);
  if (!review.author._id.equals(req.user._id)) {
      req.flash("error", "You are not the author of this review");
      return res.redirect(`/listings/${id}`);
    }
    next();
};

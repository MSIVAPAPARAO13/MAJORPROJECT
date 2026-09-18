const Review = require("../models/review");
const Listing = require("../models/listing");
const ExpressError = require("../utils/ExpressError");

// Add a review to a listing
async function addReview(listingId, reviewData, authorId) {
  const listing = await Listing.findById(listingId);
  if (!listing) {
    throw new ExpressError("Listing not found", 404);
  }

  const newReview = new Review(reviewData);
  newReview.author = authorId;

  listing.reviews.push(newReview);

  await newReview.save();
  await listing.save();

  return newReview;
}

// Delete a review from a listing
async function deleteReview(listingId, reviewId) {
  await Listing.findByIdAndUpdate(listingId, { $pull: { reviews: reviewId } });
  await Review.findByIdAndDelete(reviewId);
}

module.exports = {
  addReview,
  deleteReview
};

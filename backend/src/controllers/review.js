const reviewService = require("../services/reviewService");

module.exports.createReview = async (req, res) => {
  const { id } = req.params;
  await reviewService.addReview(id, req.body.review, req.user._id);
  req.flash("success", "Review Published!");
  res.redirect(`/listings/${id}`);
};

module.exports.destroyReview = async (req, res) => {
  const { id, reviewId } = req.params;
  await reviewService.deleteReview(id, reviewId);
  req.flash("success", "Review Removed!");
  res.redirect(`/listings/${id}`);
};

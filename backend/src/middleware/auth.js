// Authentication Middleware

const isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    req.session.redirectUrl = req.originalUrl;
    if (req.accepts("json") && req.xhr) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    req.flash("error", "You must be logged in to access that page");
    return res.redirect("/login");
  }
  next();
};

const saveRedirectUrl = (req, res, next) => {
  if (req.session.redirectUrl) {
    res.locals.redirectUrl = req.session.redirectUrl;
  }
  next();
};

module.exports = {
  isLoggedIn,
  saveRedirectUrl
};

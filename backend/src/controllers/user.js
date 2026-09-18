const User = require("../models/user");

module.exports.renderSignupForm = (req, res) => {
  res.render("users/signup.ejs");
};

module.exports.signup = async (req, res, next) => {
  try {
    const { username, email, password, role, phone } = req.body;
    const allowedRoles = ["CUSTOMER", "OWNER"];
    const userRole = allowedRoles.includes(role) ? role : "CUSTOMER";

    const newUser = new User({
      username: username.trim(),
      email: email.trim(),
      role: userRole,
      phone: phone ? phone.trim() : undefined
    });

    const registeredUser = await User.register(newUser, password);
    req.login(registeredUser, (err) => {
      if (err) return next(err);
      req.flash("success", `Welcome to WanderLust, ${registeredUser.username}!`);
      const redirectUrl = res.locals.redirectUrl || (userRole === "OWNER" ? "/dashboard" : "/listings");
      res.redirect(redirectUrl);
    });
  } catch (e) {
    req.flash("error", e.message);
    res.redirect("/signup");
  }
};

module.exports.renderLoginForm = (req, res) => {
  res.render("users/login.ejs");
};

module.exports.login = async (req, res) => {
  req.flash("success", `Welcome back, ${req.user.username}!`);
  const redirectUrl = res.locals.redirectUrl || (req.user.role === "OWNER" || req.user.role === "ADMIN" ? "/dashboard" : "/listings");
  res.redirect(redirectUrl);
};

module.exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash("success", "You have been logged out.");
    res.redirect("/listings");
  });
};
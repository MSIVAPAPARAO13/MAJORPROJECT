const userService = require("../services/userService");
const { sanitizeRedirectUrl } = require("../middleware/auth");

module.exports.renderSignupForm = (req, res) => {
  res.render("users/signup.ejs");
};

module.exports.signup = async (req, res, next) => {
  try {
    const { username, email, password, phone } = req.body;
    // Requirement 7: Public signup MUST NOT accept client-supplied role, organization, or permissions.
    // Every public signup is unconditionally assigned role: 'CUSTOMER'.
    const registeredUser = await userService.registerUser({
      username,
      email,
      password,
      role: "CUSTOMER",
      phone,
      organization: null
    });

    req.login(registeredUser, (err) => {
      if (err) return next(err);
      req.flash("success", `Welcome to WanderLust, ${registeredUser.username}!`);
      const redirectUrl = sanitizeRedirectUrl(res.locals.redirectUrl, "/listings");
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

module.exports.login = async (req, res, next) => {
  req.flash("success", `Welcome back, ${req.user.username}!`);
  const redirectUrl = sanitizeRedirectUrl(res.locals.redirectUrl, "/listings");

  // Session Fixation Protection: Regenerate session ID upon login
  if (req.session && typeof req.session.regenerate === "function") {
    const originalUser = req.user;
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.login(originalUser, (loginErr) => {
        if (loginErr) return next(loginErr);
        res.redirect(redirectUrl);
      });
    });
  } else {
    res.redirect(redirectUrl);
  }
};

module.exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    if (req.session) {
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.redirect("/listings");
      });
    } else {
      res.redirect("/listings");
    }
  });
};
const userService = require("../services/userService");
const { sanitizeRedirectUrl } = require("../middleware/auth");

const roleDashboardUrls = {
  CUSTOMER: "/customer/dashboard",
  STAFF: "/staff/dashboard",
  MANAGER: "/manager/dashboard",
  OWNER: "/owner/dashboard",
  ADMIN: "/admin/dashboard"
};

module.exports.renderSignupForm = (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return res.redirect(roleDashboardUrls[req.user.role] || "/dashboard");
  }
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
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return res.redirect(roleDashboardUrls[req.user.role] || "/dashboard");
  }
  res.render("users/login.ejs");
};

module.exports.login = async (req, res, next) => {
  // Server-authoritative role validation:
  // The selected role is ONLY a UI/validation selection.
  // The authenticated database value req.user.role is authoritative.
  // Never grant permissions from req.body.role, req.body.selectedRole, query parameters, or hidden form fields.
  // If selected role differs from authenticated role: reject safely and do not redirect to the requested role dashboard.
  const selectedRole = req.body.selectedRole;
  if (selectedRole && req.user && selectedRole !== req.user.role) {
    const actualRole = req.user.role;
    return req.logout((err) => {
      req.flash("error", `Access denied: Selected role '${selectedRole}' does not match your authenticated account role '${actualRole}'.`);
      res.redirect("/login");
    });
  }

  req.flash("success", `Welcome back, ${req.user.username}!`);

  // Role-specific dashboard redirect URLs (server uses req.user.role — never trusts selectedRole for auth)
  const roleDashboardUrls = {
    CUSTOMER: "/customer/dashboard",
    STAFF: "/staff/dashboard",
    MANAGER: "/manager/dashboard",
    OWNER: "/owner/dashboard",
    ADMIN: "/admin/dashboard"
  };

  // If there's a saved redirect URL, honour it; otherwise go to role dashboard
  const savedRedirect = sanitizeRedirectUrl(res.locals.redirectUrl, null);
  const redirectUrl = savedRedirect || roleDashboardUrls[req.user.role] || "/listings";

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
    res.clearCookie("connect.sid");
    res.clearCookie("refreshToken");
    if (req.session) {
      req.session.destroy(() => {
        res.redirect("/");
      });
    } else {
      res.redirect("/");
    }
  });
};
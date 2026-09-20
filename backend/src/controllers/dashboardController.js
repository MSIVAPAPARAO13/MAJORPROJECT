const dashboardService = require("../services/dashboardService");
const ExpressError = require("../utils/ExpressError");

function isJsonRequest(req) {
  return Boolean(
    Boolean(req.xhr) ||
    Boolean(req.originalUrl && req.originalUrl.startsWith("/api/")) ||
    Boolean(req.headers && req.headers.accept && req.headers.accept.includes("application/json")) ||
    Boolean(req.headers && req.headers["content-type"] && req.headers["content-type"].includes("application/json"))
  );
}

module.exports.renderDashboard = async (req, res) => {
  const user = req.user;
  if (!user) {
    if (isJsonRequest(req)) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    req.flash("error", "Please log in to access your dashboard");
    return res.redirect("/login");
  }

  // Dashboard filter parameters (sanitized by validateDashboardFilters)
  const filterOptions = req.validatedDashboardQuery || { preset: "30d", limit: 10 };

  // =========================================================================
  // 1. ADMIN DASHBOARD (System-Wide Analytics)
  // =========================================================================
  if (user.role === "ADMIN") {
    const data = await dashboardService.getAdminDashboard(filterOptions);
    if (isJsonRequest(req)) {
      return res.json({ success: true, role: "ADMIN", data });
    }
    return res.render("dashboard/admin.ejs", { data, user, query: filterOptions });
  }

  // =========================================================================
  // 2. OWNER & MANAGER DASHBOARD (Organization Analytics & Management)
  // =========================================================================
  if (user.role === "OWNER" || user.role === "MANAGER") {
    if (!user.organization) {
      if (isJsonRequest(req)) {
        return res.status(400).json({
          success: false,
          message: "No organization associated with this account. Please register an organization first."
        });
      }
      req.flash("error", "No organization associated with your account. Please create or join an organization.");
      return res.redirect("/organizations/new");
    }

    const data = await dashboardService.getOrganizationDashboard(user.organization, filterOptions);
    if (isJsonRequest(req)) {
      return res.json({ success: true, role: user.role, data });
    }
    return res.render("dashboard/owner.ejs", { data, user, query: filterOptions });
  }

  // =========================================================================
  // 3. STAFF OPERATIONAL DASHBOARD (Arrivals, Departures, Room Status)
  // =========================================================================
  if (user.role === "STAFF") {
    if (!user.organization) {
      if (isJsonRequest(req)) {
        return res.status(400).json({
          success: false,
          message: "Staff member has no assigned organization."
        });
      }
      req.flash("error", "Your staff account has no assigned organization. Please contact your manager.");
      return res.redirect("/listings");
    }

    const data = await dashboardService.getStaffDashboard(user.organization);
    if (isJsonRequest(req)) {
      return res.json({ success: true, role: "STAFF", data });
    }
    return res.render("dashboard/staff.ejs", { data, user });
  }

  // =========================================================================
  // 4. CUSTOMER DASHBOARD (Personal Travel & Bookings)
  // =========================================================================
  const data = await dashboardService.getCustomerDashboard(user._id, filterOptions);
  if (isJsonRequest(req)) {
    return res.json({ success: true, role: "CUSTOMER", data });
  }
  return res.render("dashboard/customer.ejs", { data, user, query: filterOptions });
};

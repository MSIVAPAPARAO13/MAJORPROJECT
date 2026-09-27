const dashboardService = require('../services/dashboardService');
const ExpressError = require('../utils/ExpressError');

/**
 * Operations Controller — serves the separate "Operations Center" views
 * for STAFF, MANAGER, OWNER, and ADMIN roles.
 *
 * Key Design Rules:
 * - Operations = real-time daily data (arrivals, departures, in-house, issues)
 * - Dashboard = analytics/KPIs
 * - Server always uses req.user.role — never trusts client-supplied role
 * - Reuses dashboardService data functions (no duplication)
 */

function isJsonRequest(req) {
  return Boolean(
    Boolean(req.xhr) ||
    Boolean(req.originalUrl && req.originalUrl.startsWith('/api/')) ||
    Boolean(req.headers && req.headers.accept && req.headers.accept.includes('application/json')) ||
    Boolean(req.headers && req.headers['content-type'] && req.headers['content-type'].includes('application/json'))
  );
}

module.exports.renderOperations = async (req, res) => {
  const user = req.user;
  if (!user) {
    if (isJsonRequest(req)) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    req.flash('error', 'Please log in to access the operations center.');
    return res.redirect('/login');
  }

  // STAFF Operations
  if (user.role === 'STAFF') {
    if (!user.organization) {
      if (isJsonRequest(req)) {
        return res.status(400).json({ success: false, message: 'Staff member has no assigned organization.' });
      }
      req.flash('error', 'Your staff account has no assigned organization. Please contact your manager.');
      return res.redirect('/listings');
    }
    const data = await dashboardService.getStaffDashboard(user.organization);
    if (isJsonRequest(req)) {
      return res.json({ success: true, role: 'STAFF', data });
    }
    return res.render('operations/staff.ejs', { data, user });
  }

  // MANAGER Operations (reuses org dashboard data for operational metrics)
  if (user.role === 'MANAGER') {
    if (!user.organization) {
      if (isJsonRequest(req)) {
        return res.status(400).json({ success: false, message: 'No organization associated with this account.' });
      }
      req.flash('error', 'No organization associated with your account.');
      return res.redirect('/organizations/new');
    }
    const data = await dashboardService.getStaffDashboard(user.organization);
    if (isJsonRequest(req)) {
      return res.json({ success: true, role: 'MANAGER', data });
    }
    return res.render('operations/manager.ejs', { data, user });
  }

  // OWNER Operations
  if (user.role === 'OWNER') {
    if (!user.organization) {
      if (isJsonRequest(req)) {
        return res.status(400).json({ success: false, message: 'No organization associated with this account.' });
      }
      req.flash('error', 'No organization associated with your account.');
      return res.redirect('/organizations/new');
    }
    const data = await dashboardService.getStaffDashboard(user.organization);
    if (isJsonRequest(req)) {
      return res.json({ success: true, role: 'OWNER', data });
    }
    return res.render('operations/owner.ejs', { data, user });
  }

  // ADMIN Operations
  if (user.role === 'ADMIN') {
    const data = await dashboardService.getAdminDashboard({ preset: '30d', limit: 10 });
    if (isJsonRequest(req)) {
      return res.json({ success: true, role: 'ADMIN', data });
    }
    return res.render('operations/admin.ejs', { data, user });
  }

  // Fallback — CUSTOMER has no operations center
  if (isJsonRequest(req)) {
    return res.status(403).json({ success: false, message: 'Operations Center is not available for CUSTOMER role.' });
  }
  req.flash('error', 'Operations Center is not available for your account type.');
  return res.redirect('/dashboard');
};

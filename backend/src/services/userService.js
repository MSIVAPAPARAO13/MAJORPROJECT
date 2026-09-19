const User = require("../models/user");
require("../models/organization");
const ExpressError = require("../utils/ExpressError");

// Register a new user using Passport-Local-Mongoose register plugin
async function registerUser({ username, email, password, role, phone, organization }) {
  if (!username || !email || !password) {
    throw new ExpressError("Username, email, and password are required", 400);
  }

  const allowedRoles = ["CUSTOMER", "OWNER"];
  const userRole = allowedRoles.includes(role) ? role : "CUSTOMER";

  const newUser = new User({
    username: username.trim(),
    email: email.trim(),
    role: userRole,
    phone: phone ? phone.trim() : undefined,
    organization: organization || undefined
  });

  const registeredUser = await User.register(newUser, password);
  return registeredUser;
}

// Find user by ID
async function getUserById(id) {
  const user = await User.findById(id).populate("organization");
  if (!user) {
    throw new ExpressError("User not found", 404);
  }
  return user;
}

// Find user by username
async function getUserByUsername(username) {
  return await User.findOne({ username }).populate("organization");
}

// Find user by email
async function getUserByEmail(email) {
  return await User.findOne({ email }).populate("organization");
}

module.exports = {
  registerUser,
  getUserById,
  getUserByUsername,
  getUserByEmail
};

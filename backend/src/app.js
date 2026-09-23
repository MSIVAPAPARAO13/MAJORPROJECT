const express = require("express");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const localStrategy = require("passport-local");

const User = require("./models/user");
const ExpressError = require("./utils/ExpressError");

// Security Middlewares
const securityHeaders = require("./middleware/securityHeaders");
const corsMiddleware = require("./middleware/cors");
const { mongoSanitize } = require("./middleware/mongoSanitize");
const { authLimiter, mutationLimiter } = require("./middleware/rateLimiter");
const csrfMiddleware = require("./middleware/csrf");

// Route handlers
const listingRouter = require("./routes/listing");
const reviewRouter = require("./routes/review");
const userRouter = require("./routes/user");
const roomRouter = require("./routes/room");
const bookingRouter = require("./routes/booking");
const guestBookingRouter = require("./routes/guestBookings");
const dashboardRouter = require("./routes/dashboard");
const organizationRouter = require("./routes/organization");
const pagesRouter = require("./routes/pages");

// API Route handlers
const apiListingsRouter = require("./routes/api/apiListings");
const apiAuthRouter = require("./routes/api/apiAuth");
const apiBookingsRouter = require("./routes/api/apiBookings");
const apiDashboardRouter = require("./routes/api/apiDashboard");

const createApp = () => {
  const app = express();

  // 1. Security Headers & CSP (Disables X-Powered-By, adds CSP, X-Content-Type-Options, etc.)
  app.use(securityHeaders);

  // 2. CORS headers for React client communication (Never uses wildcard '*' with credentials)
  app.use(corsMiddleware);

  // 3. Parsers with Request Size Limits & Static files
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(express.json({ limit: "1mb" }));
  app.use(methodOverride("_method"));

  // 4. NoSQL / MongoDB Operator Injection Sanitizer (req.body, req.query, req.params)
  app.use(mongoSanitize);

  const viewsPath = path.join(__dirname, "../views");
  const publicPath = path.join(__dirname, "../public");

  app.set("view engine", "ejs");
  app.set("views", viewsPath);
  app.engine("ejs", ejsMate);
  app.use(express.static(publicPath));

  // 5. Session & Store
  const dbUrl = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/wanderlust";
  const sessionSecret = process.env.SECRET || "medisettis594";

  // In test mode, use the built-in in-memory session store to avoid:
  // - MongoStore opening a second MongoDB TCP connection that causes buffering timeouts
  // - kruptein crypto complexity requirements on short dev secrets
  // In production/dev, MongoStore with encrypted sessions is used as before.
  let store;
  if (process.env.NODE_ENV !== "test") {
    // connect-mongo uses kruptein which requires: min 8 chars, 2 uppercase, 2 lowercase, 2 numbers, 2 special chars.
    // Append a fixed complexity suffix so any SESSION_SECRET value satisfies these rules.
    const storeCryptoSecret = sessionSecret + "_WL2!Aa#9";
    store = MongoStore.create({
      mongoUrl: dbUrl,
      crypto: {
        secret: storeCryptoSecret,
      },
      touchAfter: 24 * 60 * 60,
    });
    store.on("error", (err) => {
      console.error("[Session Store Error]:", err);
    });
  }

  const sessionOptions = {
    ...(store ? { store } : {}),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  };

  app.use(session(sessionOptions));
  app.use(flash());

  // 6. CSRF Protection Middleware (Session-backed cryptographically secure tokens)
  app.use(csrfMiddleware);

  // 7. Passport Auth
  app.use(passport.initialize());
  app.use(passport.session());
  passport.use(new localStrategy(User.authenticate()));
  passport.serializeUser(User.serializeUser());
  passport.deserializeUser(User.deserializeUser());

  // 8. Global View Variables
  app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currentUser = req.user;
    next();
  });

  // 9. CSRF Token retrieval endpoint for programmatic SPA clients
  app.get("/api/csrf-token", (req, res) => {
    return res.json({
      success: true,
      csrfToken: (req.session && req.session.csrfToken) || null
    });
  });

  // 10. Abuse Prevention: Mount Rate Limiters on Sensitive Mutation & Auth Routes
  app.use("/login", authLimiter);
  app.use("/signup", authLimiter);
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/signup", authLimiter);
  app.use("/api/bookings", mutationLimiter);

  // 11. REST API Endpoints (for React frontend)
  app.use("/api/listings/:id/rooms", roomRouter);
  app.use("/api/listings", apiListingsRouter);
  app.use("/api/auth", apiAuthRouter);
  app.use("/api/bookings", apiBookingsRouter);
  app.use("/api/dashboard", apiDashboardRouter);

  // 12. SSR Web Routes (for backward compatibility)
  app.get("/", (req, res) => {
    res.redirect("/listings");
  });

  app.use("/listings", listingRouter);
  app.use("/listings/:id/reviews", reviewRouter);
  app.use("/listings/:id/rooms", roomRouter);
  app.use("/listings/:id/rooms/:roomId/bookings", bookingRouter);
  app.use("/listings/:id/bookings", bookingRouter);
  app.use("/bookings", guestBookingRouter);
  app.use("/dashboard", dashboardRouter);
  app.use("/organizations", organizationRouter);
  app.use("/", pagesRouter);
  app.use("/", userRouter);

  // 13. 404 Handler
  app.all(/.*/, (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ success: false, message: "API endpoint not found" });
    }
    next(new ExpressError("Page Not Found", 404));
  });

  // 14. Centralized Production-Hardened Error Handler
  app.use((err, req, res, next) => {
    let { statusCode = 500, message = "Something went wrong" } = err;

    // Production Hardening: Never leak stack traces, MongoDB internals, or filesystem paths to users
    if (process.env.NODE_ENV === "production" && statusCode >= 500) {
      message = "An internal server error occurred. Please try again later.";
    }

    if (req.path.startsWith("/api/")) {
      return res.status(statusCode).json({ success: false, message });
    }
    res.status(statusCode).render("error.ejs", { message, statusCode });
  });

  return app;
};

module.exports = createApp;

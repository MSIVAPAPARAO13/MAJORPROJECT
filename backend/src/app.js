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

  // 1. CORS headers for React client communication
  app.use((req, res, next) => {
    const allowedOrigins = [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:3000",
      "http://localhost:8080",
    ];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });

  // 2. Parsers and static files
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(methodOverride("_method"));

  const viewsPath = path.join(__dirname, "../views");
  const publicPath = path.join(__dirname, "../public");

  app.set("view engine", "ejs");
  app.set("views", viewsPath);
  app.engine("ejs", ejsMate);
  app.use(express.static(publicPath));

  // 3. Session & MongoStore
  const dbUrl = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/wanderlust";
  const sessionSecret = process.env.SECRET || "medisettis594";

  const store = MongoStore.create({
    mongoUrl: dbUrl,
    crypto: {
      secret: sessionSecret,
    },
    touchAfter: 24 * 60 * 60,
  });

  store.on("error", (err) => {
    console.error("[Session Store Error]:", err);
  });

  const sessionOptions = {
    store,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true,
    cookie: {
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
    },
  };

  app.use(session(sessionOptions));
  app.use(flash());

  // 4. Passport Auth
  app.use(passport.initialize());
  app.use(passport.session());
  passport.use(new localStrategy(User.authenticate()));
  passport.serializeUser(User.serializeUser());
  passport.deserializeUser(User.deserializeUser());

  // 5. Global View Variables
  app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currentUser = req.user;
    next();
  });

  // 6. REST API Endpoints (for React frontend)
  app.use("/api/listings/:id/rooms", roomRouter);
  app.use("/api/listings", apiListingsRouter);
  app.use("/api/auth", apiAuthRouter);
  app.use("/api/bookings", apiBookingsRouter);
  app.use("/api/dashboard", apiDashboardRouter);

  // 7. SSR Web Routes (for backward compatibility)
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

  // 8. 404 Handler
  app.all(/.*/, (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ success: false, message: "API endpoint not found" });
    }
    next(new ExpressError("Page Not Found", 404));
  });

  // 9. Centralized Error Handler
  app.use((err, req, res, next) => {
    const { statusCode = 500, message = "Something went wrong" } = err;
    if (req.path.startsWith("/api/")) {
      return res.status(statusCode).json({ success: false, message });
    }
    res.status(statusCode).render("error.ejs", { message });
  });

  return app;
};

module.exports = createApp;

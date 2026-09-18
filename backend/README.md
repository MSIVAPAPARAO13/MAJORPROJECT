# WanderLust Backend Service

Enterprise-grade Node.js + Express 5 + MongoDB backend powering the WanderLust hospitality platform.

## Architecture

```text
HTTP Request
     │
     ▼
[ Express app.js ] ── (CORS, Parsers, Session, Passport)
     │
     ├─► [ /api/... Routes ] (JSON REST Endpoints for React Frontend)
     │         │
     │         ▼
     │   [ Controllers ] ──► [ Services Layer ] ──► [ Mongoose Models ] ──► [ MongoDB ]
     │
     └─► [ Web Routes ] ──► [ EJS Views ] (Backward Compatible SSR)
```

## Folder Structure

```text
backend/
├── src/
│   ├── config/
│   │   ├── db.js              # Mongoose connection & lifecycle events
│   │   └── cloudConfig.js     # Cloudinary media storage configuration
│   ├── controllers/           # HTTP controllers delegating to services
│   ├── models/                # Mongoose schemas (Listing, User, Room, Booking, Org, Review)
│   ├── routes/
│   │   ├── api/               # Dedicated REST API for React client
│   │   │   ├── apiListings.js
│   │   │   ├── apiAuth.js
│   │   │   ├── apiBookings.js
│   │   │   └── apiDashboard.js
│   │   └── ...                # Standard Web SSR routes
│   ├── middleware/            # Auth, RBAC, and Joi validation guards
│   ├── services/              # Pure business logic (atomic booking, geocoding, filters)
│   ├── validators/            # Joi schemas
│   ├── utils/                 # Error classes & wrapAsync
│   ├── app.js                 # Express app creation & middleware mounting
│   └── server.js              # Server lifecycle & HTTP listener
├── views/                     # EJS templates
├── public/                    # Static CSS & Mapbox scripts
├── .env                       # Environment variables
├── .env.example
└── package.json
```

## Available Scripts

- `npm start`: Runs the server via `node src/server.js`.
- `npm run dev`: Runs in development mode.

## API Endpoints

- `GET /api/listings`: Fetch all properties with optional query `?category=...&q=...`
- `GET /api/listings/:id`: Fetch single property with room inventory & reviews
- `GET /api/auth/me`: Check current session user
- `POST /api/auth/login`: Authenticate user
- `POST /api/auth/signup`: Register user with role (`CUSTOMER`, `OWNER`)
- `POST /api/auth/logout`: End session
- `POST /api/bookings`: Create booking atomically (with overlap checks)
- `GET /api/bookings/my`: Current user reservations
- `GET /api/dashboard/metrics`: Analytics for customers, hosts, and admins

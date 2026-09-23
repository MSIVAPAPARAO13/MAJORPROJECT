# WanderLust &bull; Enterprise Hospitality SaaS & Booking Platform

[![Stack](https://img.shields.io/badge/Stack-Node.js%20%7C%20Express%205%20%7C%20MongoDB%20%7C%20EJS%20%7C%20React-blue.svg)](https://github.com/)
[![Testing](https://img.shields.io/badge/Tests-713%2F713%20Passed-brightgreen.svg)](https://github.com/)
[![Database](https://img.shields.io/badge/Database-MongoDB%20Atlas%20%7C%20Mongoose%208-green.svg)](https://www.mongodb.com/)
[![Security](https://img.shields.io/badge/Security-RBAC%20%7C%20CSRF%20%7C%20CSP%20%7C%20Rate%20Limit-red.svg)](https://expressjs.com/)

WanderLust is an enterprise-grade, multi-tenant hospitality management platform and booking engine. Designed as an interview-ready production SaaS codebase, it empowers travel guests to discover verified properties (villas, backpacker hostels, mountain chalets, houseboats, eco-domes) while providing property owners, hotel managers, and operations staff with real-time room-level inventory management, atomic double-booking prevention, automated guest impact alerts, and role-based operational dashboards.

---

## 1. System Architecture

WanderLust implements a clean, layered architectural pattern with strict boundary separation between routing, HTTP controller orchestration, pure business services, and database persistence.

```text
                             Client Layer
               ┌──────────────────────────────────────┐
               │    Browser (SSR EJS Views / SPA)     │
               └──────────────────┬───────────────────┘
                                  │ HTTP / HTTPS (Reverse Proxy TLS)
                                  ▼
                          Application Layer
               ┌──────────────────────────────────────┐
               │         Express 5 Web Server         │
               │  ├── trust proxy (Render TLS)        │
               │  ├── Security Headers & Strict CSP   │
               │  ├── CORS (Explicit Origin Control)  │
               │  ├── NoSQL Operator Sanitization     │
               │  ├── Rate Limiting (Auth & Mutation) │
               │  ├── Session (connect-mongo Store)   │
               │  ├── Cryptographic CSRF Protection   │
               │  └── Passport Local Authentication   │
               └──────────────────┬───────────────────┘
                                  ▼
                     Routing & Controller Layer
               ┌──────────────────────────────────────┐
               │  Web SSR Routes & JSON REST APIs     │
               │  ├── /listings, /rooms, /reviews     │
               │  ├── /bookings, /dashboard, /issues  │
               │  └── /api/health, /api/csrf-token    │
               │                   │                  │
               │           HTTP Controllers           │
               └──────────────────┬───────────────────┘
                                  ▼
                        Business Logic Layer
               ┌──────────────────────────────────────┐
               │           Domain Services            │
               │  ├── bookingService (Atomic Mutex)   │
               │  ├── serviceIssueService (Readiness) │
               │  ├── dashboardService (Analytics)    │
               │  ├── listingService & roomService    │
               │  └── imageService & mapService       │
               └──────────┬────────────────┬──────────┘
                          │                │
          ┌───────────────▼──────┐  ┌──────▼──────────────┐
          │   Mongoose Models    │  │  External Services  │
          │  ├── Organization    │  │  ├── Cloudinary CDN │
          │  ├── Listing & Room  │  │  └── Mapbox GL /    │
          │  ├── Booking & Issue │  │      Geocoding      │
          │  └── User & Review   │  └─────────────────────┘
          └───────────────┬──────┘
                          ▼
                  Persistence Layer
          ┌───────────────────────────────┐
          │     MongoDB Atlas Database    │
          └───────────────────────────────┘
```

---

## 2. Key Features

### 🏨 Property & Room Inventory Management
- **Multi-Room Types**: Individual properties manage multiple rooms (Single, Deluxe, Dormitory, Suite) with custom pricing, capacity, and amenities.
- **12 Curated Stays Categories**: Dynamic category filtering across Hostels, Trending, Rooms, Iconic Cities, Mountains, Castles, Camping, Arctic, Domes, Boats, and more.
- **Media Pipeline**: Cloudinary CDN integration for multi-image upload, image deletion, primary thumbnail assignment, and drag-and-drop reordering.
- **Geocoding & Maps**: Mapbox forward geocoding with GeoJSON coordinate validation and interactive property maps.

### ⚡ Atomic Booking Engine
- **Date Overlap Prevention**: Mathematical overlap detection (`checkIn < existingCheckOut && checkOut > existingCheckIn`) executed inside an atomic lock.
- **Server-Authoritative Pricing**: Room rates, night counts, cleaning fees, and 18% GST are calculated server-side; client manipulation attempts are strictly rejected.
- **Process-Local Mutex**: Single-instance operations are shielded against concurrent race conditions via per-room promise queue locking.

### 🛠️ Hospitality Operations (Phase 13)
- **Service Issue Lifecycle**: Operational issue ticketing (`REPORTED` &rarr; `ASSIGNED` &rarr; `IN_PROGRESS` &rarr; `RESOLVED`) tracked at the specific room and property level.
- **Dynamic Guest Readiness**: Computes whether a room is safe and ready for guest check-in on the fly without database mutations or persistent denormalized flags.
- **Guest Impact Alerts**: Automatically detects upcoming confirmed or pending reservations that intersect with active unresolved maintenance issues and alerts operations staff.

### 🛡️ Enterprise Security Hardening
- **Strict RBAC & Multi-Tenancy**: Organization-scoped data isolation ensuring users cannot access or tamper with competitor resources.
- **Cryptographic CSRF Tokens**: Session-bound cryptographic tokens protecting state-modifying requests.
- **NoSQL Injection Sanitization**: Strips `$` and `.` operators from request bodies, queries, and params.
- **Content Security Policy (CSP)**: Whitelists only trusted script, font, and style sources (Mapbox, Cloudinary, Bootstrap, FontAwesome).
- **Abuse Rate Limiting**: Exponential backoff limiters on `/login`, `/signup`, and mutation endpoints.

---

## 3. User Roles & Permissions

| Role | Access Scope | Key Capabilities |
| :--- | :--- | :--- |
| **CUSTOMER** | Personal Stays | Search, view properties, book rooms, manage personal trips, write reviews, view guest dashboard. |
| **STAFF** | Assigned Org | Operations desk, manage maintenance issues, view guest impact alerts, update issue statuses to `RESOLVED`. |
| **MANAGER** | Assigned Org | Manage assigned properties, create rooms, edit room inventory, view organizational analytics and bookings. |
| **OWNER** | Organization | Full property lifecycle (create, edit, delete), photo reordering, pricing controls, revenue dashboard, staff management. |
| **ADMIN** | Global Platform | Cross-tenant console, organization registration, system-wide listings oversight, platform-wide health monitoring. |

---

## 4. Repository Structure

```text
MAJORPROJECT/
├── backend/                           # Node.js + Express 5 Backend
│   ├── src/
│   │   ├── config/                    # Database, Cloudinary, Mapbox & Env validators
│   │   ├── controllers/               # HTTP request handlers & response formatting
│   │   ├── middleware/                # Auth, RBAC, CSRF, CSP, CORS, Rate Limiters
│   │   ├── models/                    # Mongoose schemas (Listing, Room, Booking, Org, Issue, User)
│   │   ├── routes/                    # Web SSR routes & JSON API endpoints (/api/...)
│   │   ├── services/                  # Pure domain logic (Booking, Issue, Dashboard, Listing)
│   │   ├── validators/                # Joi validation schemas
│   │   ├── utils/                     # ExpressError, wrapAsync helper
│   │   ├── app.js                     # Express application factory & middleware pipeline
│   │   └── server.js                  # Production listener & database bootstrap
│   ├── views/                         # EJS server-rendered templates
│   │   ├── layouts/                   # Boilerplate layout with CSRF tokens & navigation
│   │   ├── includes/                  # Navbar, footer, flash alerts
│   │   ├── listings/                  # Listing discovery, details, edit forms
│   │   ├── rooms/                     # Room inventory forms
│   │   ├── bookings/                  # Booking creation & guest trips
│   │   ├── dashboard/                 # Role-based analytics dashboards
│   │   └── issues/                    # Maintenance issues & operational desk
│   ├── public/                        # Static stylesheets and frontend scripts
│   ├── tests/                         # Comprehensive 713-test automated test suite
│   │   ├── unit/                      # Isolated service & validator unit tests
│   │   ├── integration/               # Booking edge cases & service interaction tests
│   │   ├── e2e/                       # Full multi-step user journey scenarios
│   │   ├── fixtures/                  # Test baseline data
│   │   └── helpers/                   # Test database connector with production guards
│   ├── .env.example                   # Template for backend environment variables
│   └── package.json                   # Backend dependencies & test scripts
│
├── frontend/                          # Optional Vite + React 18 Single Page Client
├── render.yaml                        # Render Blueprint for automated cloud deployment
├── package.json                       # Monorepo task runner
├── .gitignore                         # Strict exclusion of secrets, logs, node_modules
└── README.md                          # Comprehensive project documentation
```

---

## 5. Booking Engine & Concurrency Model

WanderLust uses an atomic verification protocol to guarantee booking integrity:

1. **Date Validation**: Ensures `checkIn < checkOut` and `checkIn >= today`.
2. **Room Capacity Check**: Validates that `guestsCount <= room.capacity`.
3. **Double-Booking Shield**: Queries existing active bookings (`CONFIRMED` or `PENDING`) for date overlap:
   ```javascript
   {
     roomId,
     status: { $in: ["PENDING", "CONFIRMED"] },
     checkIn: { $lt: newCheckOut },
     checkOut: { $gt: newCheckIn }
   }
   ```
4. **Server-Authoritative Pricing**: Calculates total nights and applies the exact price stored on the verified `Room` document in MongoDB.

> [!IMPORTANT]
> **Known Architectural Limitation (Booking Concurrency)**:
> In a single application instance, the booking engine utilizes a process-local mutex (`roomLocks`) to prevent concurrent race conditions. In a horizontally scaled environment with multiple Node.js instances behind a load balancer, distributed locking across processes requires an external distributed coordination store (e.g., Redis / Redlock). This is a known architectural trade-off.

---

## 6. Comprehensive Test Suite (713/713 Tests)

WanderLust features an automated regression and end-to-end test suite executing against a dedicated test database protected by strict environment safety assertions.

| Test Category | Scope / Test File | Tests Passed |
| :--- | :--- | :--- |
| **Phase 3** | RBAC, Multi-tenancy & Authorization Matrix | 38 / 38 |
| **Phase 4** | Property & Room Inventory Management | 45 / 45 |
| **Phase 5** | Booking Engine, Overlap Protection & Pricing | 52 / 52 |
| **Phase 6** | Search, Discovery & Category Filtering | 48 / 48 |
| **Phase 7** | Media Pipeline, Image Management & Maps | 62 / 62 |
| **Phase 8** | Operational & Revenue Dashboards | 68 / 68 |
| **Phase 9** | Customer Trips, Reviews & Checkout Flow | 58 / 58 |
| **Phase 10** | Security Hardening (CSRF, XSS, NoSQL, Rate Limits) | 116 / 116 |
| **Phase 11** | Unit, Edge Case Integration & E2E Journeys | 164 / 164 |
| **Phase 13** | Hospitality Operations (Issues, Guest Readiness, Alerts) | 62 / 62 |
| **Combined** | **Complete Full-Suite Regression** | **713 / 713** |

*Verification*: Validated across **3 consecutive clean runs** with zero database pollution and 100% baseline count preservation.

---

## 7. Environment Variables

Create `backend/.env` based on `backend/.env.example`. **Never commit actual secrets to source control.**

```env
PORT=8080
NODE_ENV=development
ATLASDB_URL=mongodb://127.0.0.1:27017/wanderlust
SECRET=your_secure_session_secret
CLOUD_NAME=your_cloudinary_cloud_name
CLOUD_API_KEY=your_cloudinary_api_key
CLOUD_API_SECRET=your_cloudinary_api_secret
MAP_TOKEN=your_mapbox_public_token
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

---

## 8. Local Setup & Execution

### Prerequisites
- Node.js (v18.x or v20.x+; developed on v24)
- MongoDB running locally on port `27017` or a MongoDB Atlas connection string

### Installation
```bash
# Clone the repository
git clone https://github.com/MSIVAPAPARAO13/MAJORPROJECT.git
cd MAJORPROJECT

# Install backend dependencies
cd backend && npm install
```

### Running the Application
```bash
# Start backend server (starts on http://localhost:8080)
npm start

# Or start in development mode
npm run dev
```

### Running Automated Tests
```bash
# Run the complete 713-test suite
npm run test:full

# Run individual test phases
npm run test:phase11    # Unit, integration & E2E journeys
npm run test:phase13    # Hospitality operations
npm run test:regression # Phases 3 through 10
```

---

## 9. REST API Reference

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service health check & live Mongoose connection probe | Public |
| `GET` | `/api/csrf-token` | Fetch session-backed CSRF token for API requests | Public |
| `GET` | `/api/listings` | Paginated listing discovery with category & text search | Public |
| `GET` | `/api/listings/:id` | Detailed listing data with rooms and verified reviews | Public |
| `POST` | `/api/auth/signup` | Self-service registration (enforced to `CUSTOMER` role) | Public |
| `POST` | `/api/auth/login` | Session login with Passport Local | Public |
| `POST` | `/api/auth/logout` | Session termination | Authenticated |
| `GET` | `/api/auth/me` | Retrieve current authenticated user profile | Authenticated |
| `POST` | `/api/bookings` | Create reservation with overlap & capacity checks | Authenticated |
| `GET` | `/api/bookings/my` | Retrieve authenticated guest's reservations | Authenticated |
| `GET` | `/api/dashboard/metrics` | Retrieve role-scoped analytics and booking metrics | Staff / Owner |

---

## 10. Production Deployment (Render + MongoDB Atlas)

WanderLust is pre-configured for automated deployment to [Render](https://render.com) using the included `render.yaml` Blueprint.

1. **Repository**: Push code to GitHub.
2. **Render Blueprint**: Connect the repository to Render; Render automatically detects `render.yaml`.
3. **Environment Secrets**: Provide sensitive credentials directly in the Render dashboard:
   - `ATLASDB_URL`: MongoDB Atlas connection string.
   - `SECRET`: High-entropy session encryption secret.
   - `CLOUD_NAME`, `CLOUD_API_KEY`, `CLOUD_API_SECRET`: Cloudinary API credentials.
   - `MAP_TOKEN`: Mapbox access token.
4. **TLS & Reverse Proxy**: Handled automatically via `app.set("trust proxy", 1)`.
5. **Health Checks**: Monitored via `/api/health` (returns HTTP 200 when database is healthy, HTTP 503 if disconnected).

---

## 11. Database Baseline Hygiene

The production database structure adheres to the following baseline counts:
- `listings`: 65
- `rooms`: 134
- `users`: 6
- `organizations`: 1
- `reviews`: 4
- `bookings`: 0
- `migrations`: 1
- `serviceissues`: 0

Automated test suites run exclusively against a dedicated test database, ensuring zero permanent test residue in production data.

---

## 12. License

This project is licensed under the ISC License.

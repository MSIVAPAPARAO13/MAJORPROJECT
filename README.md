# WanderLust &bull; Enterprise Hospitality SaaS & Booking Platform

[![Stack](https://img.shields.io/badge/Stack-MERN-green.svg)](https://github.com/)
[![Node Version](https://img.shields.io/badge/Node-v22+-blue.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/MongoDB-Mongoose%208-brightgreen.svg)](https://www.mongodb.com/)
[![React](https://img.shields.io/badge/Frontend-React%2018%20(Vite)-cyan.svg)](https://react.dev/)
[![Express](https://img.shields.io/badge/Backend-Express%205-lightgrey.svg)](https://expressjs.com/)

WanderLust is an interview-ready, full-stack **MERN (MongoDB, Express, React, Node.js)** hospitality and property management SaaS platform. The application empowers travelers to discover verified stays (backpackers hostels, mountain chalets, villas, eco-domes, houseboats) while providing property hosts and organizations with room-level inventory control, atomic double-booking prevention, and SaaS revenue analytics.

---

## 1. System Architecture

The project adheres to a decoupled, multi-tier architecture with clean separation between the client presentation layer, REST API services, business logic, and persistence layers.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CLIENT (FRONTEND)                               │
│                                                                             │
│   React 18 + Vite (SPA)                                                     │
│   ├── Components & Layouts (Navbar, Footer, CategoryFilter, ListingCard)     │
│   ├── Page Views (Home, ListingDetails, Dashboard, Trust, Legal)            │
│   ├── State & Context (AuthContext for user sessions)                       │
│   └── Centralized Services (Axios HTTP Client with withCredentials: true)   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ JSON REST API (/api/...)
                                       │ (CORS Enabled with Session Cookies)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                             SERVER (BACKEND)                                │
│                                                                             │
│   Express 5 Application (backend/src/app.js)                                │
│   ├── CORS, Body Parsers, Method-Override, Session (connect-mongo)          │
│   ├── Passport Local Authentication & RBAC Middleware                       │
│   │                                                                         │
│   ├── API Routes (backend/src/routes/api/) ──► Controllers                  │
│   │                                                 │                       │
│   │                                                 ▼                       │
│   │                                          Services Layer                 │
│   │                                      (Business Logic & ACID)            │
│   │                                                 │                       │
│   └── Backward Compatible SSR Routes ───────────────┼───────────────────┐   │
│       (views/ & public/ for EJS legacy rendering)   ▼                   │   │
│                                              Mongoose Models            │   │
│                                           (Schema & Validation)         │   │
└─────────────────────────────────────────────────────┬───────────────────┴───┘
                                                      │
                                                      ▼
                                             MongoDB Database
                                      (mongodb://127.0.0.1:27017)
```

### Interview Data Flow

```text
User interacts with React UI
        ↓
Page / Component
        ↓
Centralized Service / API Call (Axios)
        ↓
Express Route (/api/...)
        ↓
Controller (HTTP validation & orchestration)
        ↓
Service (Pure business logic & atomic checks)
        ↓
Mongoose Model
        ↓
MongoDB
```

---

## 2. Key Features

- **Decoupled MERN Architecture**: Modular `frontend/` (React + Vite) and `backend/` (Express + Mongoose) codebases.
- **Atomic Booking Engine**: ACID-compliant date overlap check (`checkIn < newCheckOut && checkOut > newCheckIn`) prevents double bookings.
- **Multi-Tenant Property SaaS**: Role-based access control (`CUSTOMER`, `OWNER`, `MANAGER`, `ADMIN`) with tenant data isolation.
- **Room Management**: Properties manage multiple room types (Single, Deluxe, Dormitory, Suite) with individual pricing and capacities.
- **12 Curated Stays Categories**: Dynamic category filtering across Hostels, Trending, Rooms, Iconic Cities, Mountains, Castles, Camping, Arctic, Domes, Boats, etc.
- **Mapbox Precision Geocoding**: Forward geocoding with GeoJSON coordinates validation and location markers.
- **Cloudinary Media Pipeline**: High-resolution image storage and CDN delivery.
- **Enterprise Trust Center**: 4-point verified stay guarantee, 24/7 emergency support, and transparent checkout (+18% GST).

---

## 3. Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, React Router v6, Axios, Lucide React, Bootstrap 5, FontAwesome 6 |
| **Backend** | Node.js v22, Express 5, Mongoose 8, Passport Local, express-session, connect-mongo, Joi |
| **Database** | MongoDB (Local or Atlas) |
| **Third-Party Services** | Mapbox GL JS (Geocoding/Maps), Cloudinary (Image CDN) |

---

## 4. Folder Structure

```text
MAJORPROJECT/
├── frontend/                          # React 18 Single Page Application
│   ├── public/
│   ├── src/
│   │   ├── assets/                    # Brand assets & logos
│   │   ├── components/                # Reusable UI widgets
│   │   │   ├── Navbar/Navbar.jsx
│   │   │   ├── Footer/Footer.jsx
│   │   │   ├── ListingCard/ListingCard.jsx
│   │   │   └── CategoryFilter/CategoryFilter.jsx
│   │   ├── constants/                 # Stay categories & configuration
│   │   ├── context/                   # AuthContext session state
│   │   ├── layouts/                   # MainLayout wrapper
│   │   ├── pages/                     # Routed view components
│   │   │   ├── Home/HomePage.jsx
│   │   │   ├── ListingDetails/ListingDetailsPage.jsx
│   │   │   ├── Login/LoginPage.jsx
│   │   │   ├── Register/RegisterPage.jsx
│   │   │   ├── Dashboard/DashboardPage.jsx
│   │   │   ├── Trust/TrustPage.jsx
│   │   │   ├── Terms/TermsPage.jsx
│   │   │   ├── Privacy/PrivacyPage.jsx
│   │   │   └── Sitemap/SitemapPage.jsx
│   │   ├── routes/                    # AppRoutes definition
│   │   ├── services/                  # Centralized API service layer
│   │   │   ├── api.js                 # Axios instance with credentials
│   │   │   ├── authService.js
│   │   │   ├── listingService.js
│   │   │   └── bookingService.js
│   │   ├── App.jsx
│   │   ├── index.css                  # Design tokens & styling
│   │   └── main.jsx                   # Entry point
│   ├── vite.config.js
│   ├── .env
│   ├── .env.example
│   └── package.json
│
├── backend/                           # Node.js + Express 5 API & Engine
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js                  # Isolated Mongoose connection manager
│   │   │   └── cloudConfig.js         # Cloudinary configuration
│   │   ├── controllers/               # HTTP controllers
│   │   ├── models/                    # Mongoose schemas (Listing, User, Room, Booking, Org, Review)
│   │   ├── routes/
│   │   │   ├── api/                   # Dedicated JSON REST API
│   │   │   │   ├── apiListings.js
│   │   │   │   ├── apiAuth.js
│   │   │   │   ├── apiBookings.js
│   │   │   │   └── apiDashboard.js
│   │   │   └── ...                    # Web SSR routes (preserved)
│   │   ├── middleware/                # Auth, RBAC, and Joi validation guards
│   │   ├── services/                  # Pure business logic layer
│   │   ├── validators/                # Joi schemas
│   │   ├── utils/                     # ExpressError, wrapAsync
│   │   ├── app.js                     # Express app setup & middleware
│   │   └── server.js                  # Environment & HTTP listener
│   ├── views/                         # EJS templates (zero regression)
│   ├── public/                        # Static styles & Mapbox scripts
│   ├── init/                          # Seed data & enrich scripts
│   ├── .env
│   ├── .env.example
│   └── package.json
│
├── .gitignore                         # Protects secrets & build artifacts
├── package.json                       # Monorepo runner (concurrently)
└── README.md                          # Documentation
```

---

## 5. Environment Variables

### Backend (`backend/.env`)

```env
PORT=8080
ATLASDB_URL=mongodb://127.0.0.1:27017/wanderlust
SECRET=your_super_secret_session_key
CLOUD_NAME=your_cloudinary_cloud_name
CLOUD_API_KEY=your_cloudinary_api_key
CLOUD_API_SECRET=your_cloudinary_api_secret
MAP_TOKEN=your_mapbox_public_token
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:8080/api
```

---

## 6. How to Run Locally

### Prerequisites
- Node.js (v18 or higher recommended; project built on v22)
- MongoDB running locally on `mongodb://127.0.0.1:27017` (or provide remote connection string in `backend/.env`)

### Step 1: Install Dependencies

```bash
# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install

# Install root orchestration tool
cd .. && npm install
```

### Step 2: Start Development Servers

Run both backend and frontend concurrently:

```bash
npm run dev
```

Alternatively, run each service independently in separate terminals:

```bash
# Terminal 1: Backend API (port 8080)
npm run backend

# Terminal 2: Frontend SPA (port 5173)
npm run frontend
```

### Step 3: Access Applications

- **React Single Page Application**: [http://localhost:5173](http://localhost:5173)
- **Backend REST API**: [http://localhost:8080/api/listings](http://localhost:8080/api/listings)
- **Backward Compatible SSR Portal**: [http://localhost:8080/listings](http://localhost:8080/listings)

---

## 7. REST API Reference

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/listings` | Get all listings with optional filters (`?category=...&q=...`) | No |
| `GET` | `/api/listings/:id` | Get property details with rooms and reviews | No |
| `GET` | `/api/auth/me` | Get current authenticated user session | Session Cookie |
| `POST` | `/api/auth/signup` | Register new user account (`CUSTOMER` or `OWNER`) | No |
| `POST` | `/api/auth/login` | Authenticate user with Passport Local | No |
| `POST` | `/api/auth/logout` | Terminate session | Yes |
| `POST` | `/api/bookings` | Create reservation with overlap protection | Yes |
| `GET` | `/api/bookings/my` | Get current user's reservations | Yes |
| `GET` | `/api/dashboard/metrics` | Retrieve role-specific metrics & reservations | Yes |

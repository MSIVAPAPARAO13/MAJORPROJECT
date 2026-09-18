# WanderLust Frontend (Vite + React)

Modern, component-driven frontend application for the WanderLust hospitality platform built with React 18, React Router v6, Axios, and Bootstrap 5.

## Architecture

```text
User Interaction
       │
       ▼
[ Component / Page ] (React Hooks & State)
       │
       ▼
[ AuthContext / Context API ]
       │
       ▼
[ Centralized Services Layer ] (listingService, authService, bookingService)
       │
       ▼
[ Axios API Client (withCredentials) ]
       │
       ▼
REST API (http://localhost:8080/api)
```

## Folder Organization

```text
frontend/
├── public/
├── src/
│   ├── assets/               # Media & brand assets
│   ├── components/           # Reusable UI widgets (Navbar, Footer, ListingCard, CategoryFilter)
│   ├── constants/            # 12 stay categories & platform constants
│   ├── context/              # AuthContext session state provider
│   ├── layouts/              # MainLayout wrapper
│   ├── pages/                # Routed views (Home, ListingDetails, Login, Register, Dashboard, Legal)
│   ├── routes/               # AppRoutes definitions
│   ├── services/             # Centralized API service layer
│   ├── App.jsx               # Application root
│   ├── index.css             # Design system styling tokens
│   └── main.jsx              # React DOM entry
├── index.html
├── vite.config.js
├── .env
├── .env.example
└── package.json
```

## Available Scripts

- `npm run dev`: Start Vite development server at `http://localhost:5173`.
- `npm run build`: Build production optimized bundle in `dist/`.
- `npm run preview`: Locally preview production build.

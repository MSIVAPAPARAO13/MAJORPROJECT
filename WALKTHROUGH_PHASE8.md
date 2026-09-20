# Phase 8 — Dashboards + Analytics Walkthrough
**WanderLust SaaS Hospitality Management Platform**

---

## 1. Overview & Objectives

Phase 8 transforms WanderLust from a transactional booking engine into an analytical, multi-tenant property management platform. It delivers role-scoped, tenant-isolated dashboards and analytics with server-side MongoDB aggregation pipelines, strict zero-leak multi-tenancy, and clean separation between real-time operational turnover and historical booking value analytics.

---

## 2. Key Architecture Decisions & Invariants

### 1. Dashboard Authorization & Tenant Scope Integrity (Rules 1 & 11)
- `DASHBOARD_VIEW` grants access to dashboard capabilities, but **never allows the client to specify the tenant or dashboard scope**.
- The server strictly ignores and strips client-supplied parameters:
  - `?role=`
  - `?dashboard=`
  - `?organization=`
  - `?organizationId=`
  - `?userId=`
- Scope and dashboard type are derived strictly and securely from `req.user`:
  - **ADMIN**: System-wide platform KPIs and bounded organization performance summary.
  - **OWNER / MANAGER**: Organization-scoped performance analytics and management desk for `req.user.organization`.
  - **STAFF**: Operational turnover desk for `req.user.organization`.
  - **CUSTOMER**: Personal trips and stays strictly scoped to `Booking.guest === req.user._id`.

### 2. Staff Analytics Isolation (Rule 2)
- `STAFF` users are explicitly **denied** `ANALYTICS_VIEW`.
- The staff dashboard receives **zero financial or revenue data** (no `confirmedCompletedValue`, no `pendingPipelineValue`, no cash amounts).
- Staff view focuses exclusively on real-time operational turnover and room readiness:
  - Today's arrivals (guest, property, room, check-in time)
  - Today's departures (guest, property, room, check-out time)
  - Active in-house guests (current stays in progress)
  - Room operational status counts (`AVAILABLE`, `OCCUPIED`, `MAINTENANCE`)
  - Maintenance rooms list

### 3. Date Semantics & Operational Bounds (Rule 3)
- **Analytics Period Filters** (`today`, `7d`, `30d`, `90d`, `all`, `custom`):
  - Applied strictly to historical and aggregate metrics: booking counts, booking values, property performance, status breakdown.
- **Operational Widgets**:
  - Independent of the analytics period filter.
  - Calculated using real-time boundaries (`now`, `startOfToday..endOfToday`) for check-ins, check-outs, and active in-house guests.

### 4. Booking Value vs Net Revenue Semantics (Rule 5)
- Terminology strictly adheres to **Booking Value** (not "Net Revenue"):
  - **Confirmed + Completed Booking Value**: Realized value.
  - **Pending Pipeline Value**: Unconfirmed bookings awaiting confirmation.
  - **Cancelled Bookings**: Explicitly tracked separately and excluded from realized booking value.
  - No claim of actual cash revenue (payments/settlements are not processed).

### 5. Occupancy Semantics & Physical State Independence (Rules 6 & 7)
- **Current Occupancy**: `checkIn <= now < checkOut` with status `[PENDING, CONFIRMED]`. Future bookings are never labeled "currently occupied".
- **Date-Range Occupancy**: Evaluates date overlaps over a requested window.
- **Physical Room Status**: `Room.status` (`AVAILABLE`, `OCCUPIED`, `MAINTENANCE`) is independent of reservation occupancy. Calculations never mutate room status, and maintenance rooms are never conflated with occupied rooms.

### 6. Aggregation Design & Zero N+1 Queries (Rules 8, 9, 10)
- All metrics are calculated via server-side MongoDB aggregation pipelines with early `$match` stages on indexed fields.
- No per-property or per-room database queries in Node.js loops.
- Admin Organization Performance table is bounded using `$limit: 25` to protect Node.js memory.

### 7. Indexes Added
- `Booking`: `{ organization: 1, createdAt: -1 }` (Optimizes recent tenant bookings)
- `Booking`: `{ organization: 1, checkIn: 1, status: 1 }` (Optimizes upcoming arrivals)
- `Booking`: `{ organization: 1, checkOut: 1, status: 1 }` (Optimizes upcoming departures)
- `Room`: `{ organization: 1, status: 1 }` (Optimizes room readiness aggregation)

---

## 3. Implementation Details

### File Map
- [`backend/src/config/permissions.js`](file:///c:/Users/msiva/OneDrive/Desktop/MAJORPROJECT/backend/src/config/permissions.js): RBAC permissions and role matrix.
- [`backend/src/validators/dashboardValidator.js`](file:///c:/Users/msiva/OneDrive/Desktop/MAJORPROJECT/backend/src/validators/dashboardValidator.js): Preset and custom date range validation, sanitization.
- [`backend/src/services/dashboardService.js`](file:///c:/Users/msiva/OneDrive/Desktop/MAJORPROJECT/backend/src/services/dashboardService.js): Aggregation pipelines for Admin, Owner, Staff, and Customer.
- [`backend/src/controllers/dashboardController.js`](file:///c:/Users/msiva/OneDrive/Desktop/MAJORPROJECT/backend/src/controllers/dashboardController.js): Role routing and scope enforcement.
- [`backend/src/routes/dashboard.js`](file:///c:/Users/msiva/OneDrive/Desktop/MAJORPROJECT/backend/src/routes/dashboard.js): SSR endpoint (`GET /dashboard`).
- [`backend/src/routes/api/apiDashboard.js`](file:///c:/Users/msiva/OneDrive/Desktop/MAJORPROJECT/backend/src/routes/api/apiDashboard.js): REST API endpoints (`GET /api/dashboard`, `GET /api/dashboard/metrics`).
- [`backend/views/dashboard/admin.ejs`](file:///c:/Users/msiva/OneDrive/Desktop/MAJORPROJECT/backend/views/dashboard/admin.ejs): Superadmin platform monitor.
- [`backend/views/dashboard/owner.ejs`](file:///c:/Users/msiva/OneDrive/Desktop/MAJORPROJECT/backend/views/dashboard/owner.ejs): Owner/Manager organization analytics desk.
- [`backend/views/dashboard/staff.ejs`](file:///c:/Users/msiva/OneDrive/Desktop/MAJORPROJECT/backend/views/dashboard/staff.ejs): Staff operational turnover desk.
- [`backend/views/dashboard/customer.ejs`](file:///c:/Users/msiva/OneDrive/Desktop/MAJORPROJECT/backend/views/dashboard/customer.ejs): Customer personal trip portal.
- [`backend/tests/phase8_dashboard_analytics.test.js`](file:///c:/Users/msiva/OneDrive/Desktop/MAJORPROJECT/backend/tests/phase8_dashboard_analytics.test.js): Automated test suite.

---

## 4. Verification & Automated Test Results

### Phase 8 Test Suite (`backend/tests/phase8_dashboard_analytics.test.js`)
- **Total Tests Executed**: 84
- **Passed**: 84
- **Failed**: 0
- **Success Rate**: 100%

### Full Platform Regression
| Test Suite | Scope | Target | Result | Status |
| :--- | :--- | :---: | :---: | :---: |
| **Phase 3** | Security, RBAC & Multi-Tenancy | 46 / 46 | 46 / 46 | **PASSED** |
| **Phase 4** | Property & Room Management | 49 / 49 | 49 / 49 | **PASSED** |
| **Phase 5** | Booking Engine & Concurrency | 49 / 49 | 49 / 49 | **PASSED** |
| **Phase 6** | Search & Discovery | 58 / 58 | 58 / 58 | **PASSED** |
| **Phase 7** | Images & Maps | 82 / 82 | 82 / 82 | **PASSED** |
| **Phase 8** | Dashboards & Analytics | 100% | 84 / 84 | **PASSED** |
| **Total Platform** | **Full System Regression** | **All** | **368 / 368** | **100% PASSED** |

---

## 5. Database Baseline Preservation

| Collection | Pre-Phase 8 Count | Post-Phase 8 Count | Status |
| :--- | :---: | :---: | :---: |
| `users` | 6 | 6 | Preserved |
| `listings` | 65 | 65 | Preserved |
| `rooms` | 134 | 134 | Preserved |
| `organizations` | 1 | 1 | Preserved |
| `reviews` | 4 | 4 | Preserved |
| `bookings` | 0 | 0 | Preserved |
| `migrations` | 1 | 1 | Preserved |
| `sessions` | 125 | 125 | Preserved |

---

## 6. Git Checkpoint
- **Branch**: `phase-8-dashboards-analytics`
- **Base Commit**: `c20cdf1` (`feat: add image and map management`)
- **Final Commit**: `cba270e` (`feat: add dashboards and analytics`)
- **Status**: STOP condition reached. Halting as instructed before Phase 9.

# CargoFlow AI – Fleet Routing & Smart Shuffling

An intelligent, full-stack logistics optimization and real-time fleet coordination platform. CargoFlow AI combines topographic fuel modeling, LIFO cargo bay access penalty calculation, vertical dwell friction ($D_f$), cold-chain thermal decay monitoring, and **"The Baton Pass"** multi-vehicle swarm relay algorithm.

> **Prototype Notice**: This platform is a prototype and simulation environment developed for research and educational purposes. Cellular GPS streaming uses browser-level Geolocation APIs, SMS/email alerts are simulated records, and cold-chain calculations represent mathematical thermal dissipation models rather than certified medical instrumentation.

---

## 1. Project Overview & Architecture

CargoFlow AI is an end-to-end logistics platform designed around three synchronized user roles:
1. **Fleet Dispatcher / Admin Hub** (`/` or `/admin`): Real-time interactive Leaflet fleet map, smart shuffling recalculation, baton pass rendezvous execution, vertical dwell friction monitoring, and Google Gemini AI briefings.
2. **Customer Portal** (`/customer`): Real-time product ordering catalog, delivery location & property type selector, automated assignment tracking, dynamic ETA countdown, and 6-digit Delivery OTP issuance.
3. **Driver Mobile Tracking Mode** (`/driver`): Mobile-optimized outdoor interface utilizing device `navigator.geolocation.watchPosition` to stream live GPS (latitude, longitude, speed, heading, accuracy) to the fleet backend, route progress tracker, and customer OTP delivery confirmation.

```
                              ┌─────────────────────────────────────────┐
                              │            CargoFlow AI                 │
                              │       Express + Vite Server             │
                              └───────┬─────────────────────────┬───────┘
                                      │                         │
                     HTTP REST APIs   │                         │ Socket.IO Real-time Events
                                      ▼                         ▼
┌──────────────────────────┐    ┌──────────────────────────┐    ┌──────────────────────────┐
│   Customer Portal        │    │    Fleet Admin Hub       │    │    Driver Mobile Mode    │
│  - Catalog Browsing      │    │  - Leaflet Map (Live/Sim)│    │  - Browser Geolocation   │
│  - MongoDB Persistence   │    │  - Smart Shuffling       │    │  - watchPosition() GPS   │
│  - Single-Vehicle Map    │    │  - Baton Pass Swarms     │    │  - Route Checkpoints     │
│  - Secure Delivery OTP   │    │  - Cold-Chain Decay      │    │  - OTP Confirmation      │
└──────────────────────────┘    │  - Gemini AI Briefings   │    └──────────────────────────┘
                                └─────────────┬────────────┘
                                              │
                         ┌────────────────────┴────────────────────┐
                         ▼                                         ▼
            ┌──────────────────────────┐              ┌──────────────────────────┐
            │   Embedded MongoDB       │              │  Google Gemini 3.8 Flash │
            │   (MongoMemoryServer)    │              │  Tactical Fleet AI       │
            └──────────────────────────┘              └──────────────────────────┘
```

---

## 2. Technology Stack

* **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Leaflet & React Leaflet, Lucide Icons, Socket.IO Client.
* **Backend**: Node.js, Express, TypeScript (`tsx`), Socket.IO Engine, Dotenv (`.env.local` preference).
* **Database**: MongoDB with embedded in-memory database (`mongodb-memory-server`) for instantaneous, zero-configuration local execution.
* **AI & Decision Support**: Official Google GenAI SDK (`@google/genai`) connecting to Gemini 3.8 Flash with structured JSON analysis and reliable heuristics fallback.
* **Telemetry**: Browser Geolocation API (`watchPosition` / `clearWatch`) streaming live speed, heading, and accuracy to MongoDB and all connected socket rooms.

---

## 3. Installation & Setup

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher

### Step 1: Install Dependencies
```bash
npm install --legacy-peer-deps
```

### Step 2: Configure Environment Variables
Create or edit `.env.local` in the project root:
```env
# Google Gemini API Key (Server-side only; never exposed to browser)
GEMINI_API_KEY=your_gemini_api_key_here

# Port (Defaults to 3000)
PORT=3000
```
> If no `GEMINI_API_KEY` is provided, CargoFlow AI automatically falls back to an internal heuristic rule engine without failing or crashing.

---

## 4. Running the Application

### Development Mode (Recommended)
```bash
npm run dev
```
This automatically boots:
1. Embedded MongoDB instance on `mongodb://127.0.0.1:27017/`
2. Database seeder (50 demo deliveries, 3 trucks, 6 catalog products, 3 driver profiles, central SF depot)
3. Express REST API & Socket.IO server
4. Vite dev server serving the client at `http://localhost:3000`

---

## 5. Authentication Architecture & Security Model

CargoFlow AI implements full-stack, enterprise-grade authentication with cryptographically enforced Role-Based Access Control (RBAC) across both backend and frontend layers:

```
[Browser Request]
       │
       ▼
[HttpOnly Secure Cookie: cargoflow_token]
       │
       ▼
[Express authenticateUser Middleware]
       │  ├── 1. Extracts & cryptographically verifies JWT (HS256)
       │  ├── 2. Queries MongoDB to verify active user status (rejects disabled accounts)
       │  └── 3. Attaches sanitized { id, email, role, customerId, driverId, assignedVehicleId } to req.user
       ▼
[Express requireRole("ADMIN" | "CUSTOMER" | "DRIVER") Middleware]
       │
       ├──► ADMIN:    Full fleet management, 2-opt optimization, Baton Pass handoffs, Gemini AI
       ├──► DRIVER:   Restricted to own assigned vehicle telemetry and deliveries (cross-truck locked)
       └──► CUSTOMER: Restricted to own order history and assigned truck GPS (customer data isolated)
```

### Key Security Safeguards
1. **Password Security**: Hashed with `bcryptjs` (salt rounds = 10). Plain-text passwords and password hashes are never stored insecurely or returned in responses.
2. **HttpOnly Cookie Tokens**: Tokens are delivered via `cargoflow_token` cookies with `httpOnly: true` and `sameSite: "lax"`, mitigating XSS credential theft. No passwords or tokens in `localStorage`.
3. **Customer Data Isolation**: Backend strictly validates `req.user.customerId === order.customerId` before returning order tracking or personal address info. Customers cannot tamper with URL parameters to inspect other shipments.
4. **Driver Vehicle Lockdown**: `POST /api/trucks/:truckId/location` cryptographically matches `req.user.assignedVehicleId === truckId`. Cross-truck manipulation returns `403 Forbidden`.
5. **No Open Admin Registration**: Admin accounts cannot be created via public registration. Public registration strictly enforces the `CUSTOMER` role.

---

## 6. Seeded Demo Accounts & Credentials

> [!IMPORTANT]
> **DEMO CREDENTIALS NOTICE**: The following credentials are provided for demonstration, testing, and evaluation. Passwords must be rotated before deploying to production environments.

| Role | Name | Email | Password | Assigned Vehicle / Scope |
| :--- | :--- | :--- | :--- | :--- |
| **ADMIN** | Fleet Dispatch Admin | `admin@cargoflow.demo` | `Admin@CargoFlow2026!` | Global Fleet Authority (`ADM-01`) |
| **DRIVER** | Marcus Vance | `driver01@cargoflow.demo` | `Driver01@2026!` | Assigned to **Van 01 (`TRK-01`)** |
| **DRIVER** | Elena Rostova | `driver02@cargoflow.demo` | `Driver02@2026!` | Assigned to **Van 02 (`TRK-02`)** |
| **DRIVER** | Darnell Washington | `driver03@cargoflow.demo` | `Driver03@2026!` | Assigned to **Van 03 (`TRK-03`)** |
| **CUSTOMER** | Kishore Kumar | `customer01@cargoflow.demo` | `Customer01@2026!` | Self-Service Orders (`CUST-101`) |
| **CUSTOMER** | Dr. Sarah Jenkins | `customer02@cargoflow.demo` | `Customer02@2026!` | Self-Service Orders (`CUST-102`) |
| **CUSTOMER** | Marcus Thorne | `customer03@cargoflow.demo` | `Customer03@2026!` | Self-Service Orders (`CUST-103`) |
| **DISABLED** | Deactivated Test User | `disabled@cargoflow.demo` | `Disabled@2026!` | Disabled Account (Returns 403) |

---

## 7. User Roles & Protected Routes

| Portal Route | Required Role | Unauthenticated Action | Unauthorized Role Action |
| :--- | :--- | :--- | :--- |
| `/login` | Public | Role Selection Landing Hub | N/A |
| `/customer/login` | Public | Customer Login Form | N/A |
| `/customer/register` | Public | Customer Self-Registration Form | N/A |
| `/admin/login` | Public | Fleet Admin Login Form | N/A |
| `/driver/login` | Public | Mobile Driver Login Form | N/A |
| `/customer/*` | `CUSTOMER` or `ADMIN` | Redirects to `/customer/login` | Shows **ACCESS DENIED** modal with redirect |
| `/admin/*` | `ADMIN` | Redirects to `/admin/login` | Shows **ACCESS DENIED** modal with redirect |
| `/driver/*` | `DRIVER` or `ADMIN` | Redirects to `/driver/login` | Shows **ACCESS DENIED** modal with redirect |

---

## 8. Mobile Driver GPS Setup & Testing

### Testing on a Physical Phone via LAN:
1. Ensure your computer and smartphone are connected to the same Wi-Fi network.
2. Find your computer's local IP address (`ipconfig` on Windows or `ifconfig` on macOS/Linux), e.g., `192.168.1.50`.
3. Open `http://192.168.1.50:3000/driver` on your smartphone browser (Chrome, Safari, Firefox).
4. Tap **[START LIVE GPS TRACKING]** and tap **Allow** when prompted for location access.
5. Watch the GPS status change from `GPS CONNECTING` to `GPS ACTIVE ●`.
6. Look at the Admin Leaflet Map (`http://localhost:3000/`): the truck marker will display a green pulsating `LIVE GPS ●` badge with live speed, heading, and accuracy!

### Browser Geolocation & HTTPS Limitations:
* **Localhost**: Modern mobile and desktop browsers allow Geolocation on `http://localhost`.
* **LAN IP**: Some modern mobile browsers restrict `navigator.geolocation` on non-secure `http://` LAN IPs. If your browser blocks location access, Chrome allows whitelisting:
  * In Chrome on Android: navigate to `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, enter `http://<YOUR-LAN-IP>:3000`, and enable.
* **Background Tracking**: Browser security restrictions suspend `navigator.geolocation` when the phone is locked or browser is minimized. Active foreground tracking on the driver page is recommended during demonstrations.

---

## 7. Key Algorithmic Modules

### A. Smart Shuffling
Recalculates truck delivery sequences upon traffic delays or newly placed orders by balancing:
* Time window SLA urgency (Critical > High > Medium > Standard)
* Topographic elevation and steep grade energy penalties
* LIFO cargo accessibility in the rear van bed
* Vertical Dwell Friction ($D_f$)

### B. "The Baton Pass" Multi-Vehicle Swarm Relay
When an at-risk package is delayed by corridor gridlock:
1. The system scans nearby fleet vehicles with excess capacity and clear trajectories.
2. Identifies viable urban rendezvous hubs (e.g., *Market & 10th Commercial Staging Bay*).
3. Calculates synchronized arrival time windows.
4. With a single click (`[AUTHORIZE BATON PASS]`), package custody is reassigned in MongoDB, vehicle routes recalculate, and customer tracking automatically follows the new relay vehicle.

### C. Vertical Dwell Friction ($D_f$)
Models the last-mile operational overhead beyond curb arrival:
* **Commercial High-Rise**: Elevator transit + security badge protocol ($+12$ to $+18$ min).
* **Gated Villa Community**: Security callbox clearance and cul-de-sac navigation ($+6$ to $+10$ min).
* **Ground-Level Retail**: Fast curb drop ($+2$ to $+4$ min).

### D. Cold-Chain Thermal Decay
Simulates perishable biologics and artisan perishables under ambient summer temperatures ($31^\circ\text{C}$). Computes safe runway time before spoilage, transitioning risk states (`SAFE` $\to$ `AMBER_WARNING` $\to$ `RED_CRITICAL`).

---

## 8. Controlled Demo Scenarios

The Admin Portal features 5 deterministic one-click simulation scenarios:
1. **Normal Ops**: Baseline fleet schedule across San Francisco.
2. **Heavy Traffic (+35m)**: Injects corridor delay on TRK-01, triggering SLA breach alerts and Baton Pass rendezvous options.
3. **Cold-Chain Risk**: Induces thermal stress on refrigerated pharma, re-evaluating route priority.
4. **High-Rise Dwell**: Escalates vertical elevator delays on downtown commercial towers.
5. **Multi-Gridlock Relay**: Creates multi-vehicle gridlock requiring swarm baton pass handoffs.
6. **Reset Fleet Data**: Instantly restores 50 fresh mock deliveries in MongoDB.

---

## 9. Google Gemini AI Integration

CargoFlow AI connects to the official `@google/genai` JavaScript SDK using `gemini-3.8-flash`:
* **Endpoint**: `POST /api/ai/briefing`
* **Data Transmitted**: Real-time snapshot of all vehicles, GPS states, at-risk deliveries, cold-chain status, and baton pass candidates.
* **Structured Output**: Headline, operational risks, recommended dispatcher actions, relay opportunities, and fuel impact.
* **Fault-Tolerant**: If no API key is provided or quota limits are exceeded, a structured rule-based heuristic briefing is returned instantly without failing.

---

## 10. Prototype Boundaries & Real-World Disclaimers

1. **Live GPS Data**: Live coordinates are received only when a driver clicks **Start Tracking** in an active browser tab on their device. Simulated trucks run on mathematical corridor paths.
2. **Simulated Alerts**: Customer SMS and email notifications are simulated records stored in MongoDB and broadcast via Socket.IO.
3. **Payments & Orders**: Products, pricing, and orders represent demonstration catalog data. No physical payments are processed.
4. **Cold Chain**: Thermal decay curves are heuristic mathematical models and must not be used for actual medical refrigeration certification.

# CargoFlow AI – Demonstration Guide & Authentication Quickstart

This guide documents the complete logistics platform architecture, live demonstration flow, and **cryptographic role-based authentication system** for **CargoFlow AI – Fleet Routing & Smart Shuffling**.

---

## 🔐 Demo Accounts & Credentials

> [!IMPORTANT]
> **NOTICE**: The credentials listed below are **DEMO / SEED ACCOUNTS** configured for college prototyping and evaluation. In production environments, passwords must be rotated, administrative self-registration disabled, and environment secrets managed via hardware security modules or secure key management vaults.

All demo accounts are seeded with **bcrypt cryptographic hashes** (salt rounds = 10) in MongoDB upon initialization. Plain-text passwords are never stored in the database or exposed over APIs.

| Role | Name / Identifier | Email / Login ID | Password | Scope & Assigned Asset |
| :--- | :--- | :--- | :--- | :--- |
| **ADMIN** | Fleet Dispatch Admin (`ADM-01`) | `admin@cargoflow.demo` | `Admin@CargoFlow2026!` | Global Fleet Authority, 2-Opt Optimizer, Baton Pass, Gemini AI |
| **DRIVER** | Marcus Vance (`DRV-01`) | `driver01@cargoflow.demo` | `Driver01@2026!` | Assigned to **Van 01 (`TRK-01`)**, Live GPS Broadcast, LIFO Bay |
| **DRIVER** | Elena Rostova (`DRV-02`) | `driver02@cargoflow.demo` | `Driver02@2026!` | Assigned to **Van 02 (`TRK-02`)**, Live GPS Broadcast, LIFO Bay |
| **DRIVER** | Darnell Washington (`DRV-03`) | `driver03@cargoflow.demo` | `Driver03@2026!` | Assigned to **Van 03 (`TRK-03`)**, Live GPS Broadcast, LIFO Bay |
| **CUSTOMER** | Kishore Kumar (`CUST-101`) | `customer01@cargoflow.demo` | `Customer01@2026!` | Commercial High-Rise, Isolated Order Tracking |
| **CUSTOMER** | Dr. Sarah Jenkins (`CUST-102`) | `customer02@cargoflow.demo` | `Customer02@2026!` | Biologics / Cold-Chain Orders, Isolated Order Tracking |
| **CUSTOMER** | Marcus Thorne (`CUST-103`) | `customer03@cargoflow.demo` | `Customer03@2026!` | Gated Villa Orders, Isolated Order Tracking |
| **DISABLED** | Deactivated Test User | `disabled@cargoflow.demo` | `Disabled@2026!` | Account Deactivated (403 Forbidden verification) |

---

## 🚀 How to Start the Project

1. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
2. Start the integrated dev server:
   ```bash
   npm run dev
   ```
3. Open your browser at:
   ```
   http://localhost:3000/
   ```

---

## 🧪 Testing Authentication & RBAC

You can run the automated 18-point verification test suite at any time:
```bash
node test-auth-suite.js
```

### Manual Testing Scenarios:

#### 1. Role Selection Landing Hub (`/login` or `/`)
* Navigate to `http://localhost:3000/login`.
* Observe the 3 glassmorphic cards: **[ CUSTOMER LOGIN ]**, **[ DRIVER LOGIN ]**, **[ ADMIN LOGIN ]**.
* Click any card to enter the dedicated authentication view.

#### 2. Customer Registration & Login (`/customer/register` & `/customer/login`)
* Go to `http://localhost:3000/customer/register`.
* Fill in Full Name, Email, Phone, Delivery Address, and Password (min 8 chars).
* Role is strictly locked to `CUSTOMER`.
* Click **[ REGISTER CUSTOMER ACCOUNT ]** $\to$ shows `ACCOUNT CREATED SUCCESSFULLY` with assigned Customer ID (`CUST-...`).
* Click **[ PROCEED TO CUSTOMER LOGIN ]** and log in with your credentials.
* Welcome banner displays: `Welcome, [Your Name]`.
* Header shows: `[ Profile ] [ Orders ] [ Notifications ] [ Logout ]`.

#### 3. Unauthorized Access Rejection (Access Denied)
* While logged in as a Customer, attempt to navigate to `http://localhost:3000/admin`.
* The system blocks access and renders the **ACCESS DENIED** security violation modal:
  * Shows your active user name and role (`CUSTOMER`).
  * Informs that the route requires `ADMIN`.
  * Provides a single-click button: **[ RETURN TO CUSTOMER ORDERS & TRACKING ]**.
* Attempt to fetch administrative endpoints (e.g. `POST /api/optimize` or `GET /api/customers`) $\to$ backend returns `403 Forbidden`.

#### 4. Driver Vehicle Lockdown & GPS Telemetry Security
* Log in as **Driver 1** (`driver01@cargoflow.demo`).
* You are redirected to `/driver`.
* Header displays: `Driver: Marcus Vance`, `Truck: TRK-01`, `GPS: ACTIVE / STANDBY`.
* Click **[ START LIVE GPS TRACKING ]**: coordinates update for `TRK-01` (`200 OK`).
* If a driver attempts to broadcast GPS coordinates for `TRK-02` (assigned to Driver 2), the backend RBAC checks `driver.assignedVehicleId === truckId` and immediately rejects the request with **403 Forbidden**.

#### 5. Fleet Admin Operations (`/admin/login` & `/admin`)
* Log in as Admin (`admin@cargoflow.demo` / `Admin@CargoFlow2026!`).
* System Status in sidebar displays:
  * `Authentication: ● ACTIVE`
  * `Current Admin: admin@cargoflow.demo` (no password or hash exposed)
* Full access to 2-Opt optimization, Baton Pass swarm relays, Cold-Chain heat stall simulations, and Gemini AI briefings.

#### 6. Logout & Session Invalidation
* Click **[ LOGOUT ]** from any portal header.
* Session cookie `cargoflow_token` is cleared (`Max-Age=0`).
* Attempting to access protected pages without authenticating immediately redirects to `/login`.
* Refreshing the browser while logged in restores the session seamlessly via HttpOnly cookie validation against `/api/auth/me`.

---

## 5-Minute Live Presentation Sequence

### Minute 1: Authentication & Customer Self-Service Ordering
1. Open `http://localhost:3000/login`. Explain the 3 isolated enterprise roles: Customer, Driver, and Admin.
2. Log in as Customer `customer01@cargoflow.demo`.
3. Select product **"Cold-Chain Biologics & Vaccines (2-8°C)"**, enter delivery address with property type **"Commercial High-Rise"**, and submit order.
4. Highlight generated 6-digit OTP and dwell friction calculations.

### Minute 2: Driver Mobile Portal & Live Telemetry
1. Open another tab at `http://localhost:3000/driver/login`.
2. Log in as `driver01@cargoflow.demo`.
3. Show assigned truck `TRK-01` and LIFO cargo manifest.
4. Click **[ START LIVE GPS TRACKING ]**. Status shifts to **`GPS ACTIVE ●`**.

### Minute 3: Fleet Admin Control & Heavy Traffic Cascade
1. Open `http://localhost:3000/admin/login`. Log in as `admin@cargoflow.demo`.
2. In the Fleet Map, observe `TRK-01` pulsing green with live GPS telemetry.
3. In the Simulation Toolbar, click **`2. Heavy Traffic (+35m)`** on `TRK-01`.
4. Observe real-time cascade: Delayed alert triggers, SLA drops, and Smart Shuffling reorders stops.

### Minute 4: "The Baton Pass" Swarm Relay
1. Under Admin, click the **Baton Pass** tab.
2. Select rendezvous corridor between `TRK-01` (stalled) and `TRK-02` (empty capacity).
3. Click **[ Authorize Window Handoff ]**.
4. Real-time Socket.IO broadcasts handover, and the customer's portal seamlessly switches tracking to `TRK-02`.

### Minute 5: OTP Confirmation & Gemini AI Briefing
1. In Driver portal, mark arrival at destination and enter customer's 6-digit OTP.
2. Status confirmed $\to$ `DELIVERED`.
3. In Admin portal, click **[ Gemini AI Briefing ]**. Gemini generates an executive tactical debrief summarizing fuel impact, dwell efficiency, and relay performance!

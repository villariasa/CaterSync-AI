# CaterSync-AI — Complete Gap Analysis & Production Development Roadmap

**Prepared from a full read-through of the uploaded codebase (`CaterSync-AI-main.zip`)** — every finding below is tied to an actual file, table, or code path in your repo, not a generic template.

---

## Part 0 — Methodology

I extracted the zip and inspected: `db/schema.sql`, `db/seed.sql`, all 9 `src/routes/*/+page.svelte` pages, all 12 `src/routes/api/**/+server.js` routes, `src/lib/server/db.js`, `src/lib/mockData.js`, `src/routes/+layout.js`, all 9 files in `ml-service/app/routes/`, `ml-service/app/core/model_loader.py`, both files in `ml-service/app/training/`, `docker-compose.yml`, and your own project docs (`plan.md`, `task.md`, `walkthrough.md`). That combination tells a very clear, consistent story, which Part 1 and Part 2 lay out before we get to the "what to add" list you asked for.

---

## Part 1 — Reality Check: What CaterSync-AI Actually Is Today

Your `plan.md` and `task.md` describe this as a **14-week capstone project** ("AI Catering Intelligence Platform," built for a technical defense/portfolio). That context matters, because it explains *why* the app is scoped the way it is: it was built to demonstrate 9 ML/optimization techniques convincingly in a demo, not to run a real catering business end-to-end. Judged against that goal, it's a solid piece of engineering. Judged against **"an app that has it all from setting the order, purchasing, inventory, booking"** — which is what you're asking for now — it currently covers a narrow slice.

| Layer | Current State |
|---|---|
| Data model | 15 tables total, single business, no financial layer (no invoices/payments/tax), no users table |
| Frontend | 9 pages: Customers, Planner (booking), Inventory, Suppliers, Menus, Staff, Scheduling, Audits, Settings |
| Auth | Client-side only, no password hashing, no server session, no route protection — detailed in Part 3 |
| "AI" modules | 9 endpoints exist; **only 2 are wired to real solvers with real logic**, the rest are hardcoded or randomized (Part 2) |
| Multi-branch / multi-tenant | Not possible — `business_settings` is a single hardcoded row (`id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1)`) |
| Tests | Claimed complete in `task.md`; **zero test files exist anywhere under `src/`** |
| Payments/invoicing/contracts | Not present anywhere in the schema or code |

None of this is a criticism of the capstone — it's the right scope for that assignment. But it means the honest starting point for your new goal is: **you're not "finishing" this app, you're taking it from a single-business AI demo to a multi-module operating system for a catering business.** That's a big, legitimate, buildable project — Part 4 is the exhaustive list you asked for.

---

## Part 2 — 🚨 Critical Finding: Most of the "AI" Is Not Actually Running

Before adding new modules, you need to know this, because it changes what "finish the AI layer" means (fix/rebuild vs. build-new). I checked every route in `ml-service/app/routes/` against `ml-service/app/core/model_loader.py` and the training scripts. Findings:

| # | Module | Claimed Technique | What The Code Actually Does | Evidence |
|---|---|---|---|---|
| 1 | Food Quantity Prediction | XGBoost Regressor | Tries to load `food_qty_xgboost.pkl` — **file does not exist anywhere in the repo**, so it always runs the fallback: `guest_count × 0.40 × type_multiplier × outdoor_multiplier`. Training script (`train_quantity_model.py`) exists and is legitimate, it's just never been run/committed. | `quantity.py` L31, `model_loader.py` |
| 2 | Menu Generator | Integer Linear Programming (PuLP) | **Genuinely real** PuLP solver — but selects from a hardcoded 5-item `DEFAULT_MENUS` list in Python, never queries your real `menus`/`menu_items` tables. | `menu.py` L28-33 |
| 3 | Ingredient Purchasing | EOQ + greedy supplier selection | **Genuinely real** formula (`EOQ = sqrt(2·D·S/H)`) and real greedy scoring — legitimate, and correctly designed to accept real data if the caller passes it in. | `purchasing.py` |
| 4 | Kitchen Scheduler | OR-Tools CP-SAT job-shop solver | **Real CP-SAT model**, but solves the *same fixed 4-task schedule* (Prep 60m → Cook 120m → Portion 30m → Loading 45m) every time, regardless of which dishes were actually selected. `menu_items.prep_time_minutes` — the column that exists specifically for this — is never read. | `scheduler.py` L27-50 |
| 5 | Staff Assignment | Random Forest + Hungarian Algorithm | Hungarian algorithm (`scipy.linear_sum_assignment`) is **genuinely implemented**. But there's no Random Forest anywhere (no training script exists for it) — role counts come from a hardcoded ratio (`guests/40` servers, etc.), and matching runs against a **hardcoded fictional 8-person roster** (`DEFAULT_STAFF`), never your real `staff` table. | `staff.py` L22-31 |
| 6 | Profit Analyzer | Isolation Forest anomaly detection | **Entirely fabricated.** `random.seed(request.event_id)` generates a fake revenue and fake costs from scratch every call — it never reads your real `event_costs` table. The UI even shows a toast saying *"Profit metrics audited via Isolation Forest."* | `profit.py` L32-38, `audits/+page.svelte` |
| 7 | Customer Preference Learning | Cosine similarity recommender | **Entirely fabricated.** Recommendation logic is `if customer_id % 2 == 0: prefers Seafood`. No vectors, no similarity math, no query against `customers`/`event_menus` history, and the menu list is a hardcoded 4 items. | `recommender.py` L36-44 |
| 8 | Event Risk Prediction | Logistic Regression | **Entirely fabricated** hardcoded if/else scoring (+0.45 if outdoor, +0.22 if >180 guests, etc.), mislabeled as `model_version="logistic_regression_v1.0"`. **It also has a bug that will crash it in production** — see Part 3. | `risk.py` L28-45 |
| 9 | Sales Forecasting | Prophet vs. SARIMA | **Entirely fabricated.** The live endpoint generates a sine-like wave (`wave = i*0.15 + (i%3)*0.30`) with zero connection to your real `events` table. The real training script (`train_sales_forecast.py`) exists but its output is never loaded by the serving endpoint. | `forecasting.py` L23-41 |

**Bottom line:** of 9 modules, 3 (Menu, Purchasing, Scheduler) run real algorithms — but on hardcoded or incomplete data — 1 (Staff) is half-real, and 4 (Profit, Recommender, Risk, Forecasting) do no data science at all; they're randomized or rule-based numbers wearing an ML label. This was a reasonable way to guarantee a smooth capstone demo without depending on having enough real data yet. It is **not something you can ship to a real business owner** who will make purchasing and staffing decisions based on these numbers. Part 4, Section R gives this its own rebuild plan.

---

## Part 3 — 🚨 Critical Foundational Defects (fix before adding anything else)

These aren't "missing modules" — they're structural problems that will undermine every module you build on top of them if left as-is.

### 3.1 There is no real authentication or authorization
- `LandingPage.svelte` stores the "logged in user" in a Svelte `$state()` variable — **in-memory, client-side only**. Refresh the tab and it's gone.
- The default login, if no one has "registered" yet, is a hardcoded fallback: `{ username: 'admin', password: 'admin' }`.
- "Registration" stores the password in plaintext in browser memory — no hashing, no `users` table (there isn't one), nothing sent to a server to persist.
- The PIN defaults to `'1234'`.
- There is **no `hooks.server.js`** anywhere in the project, and `src/routes/+layout.js` sets `export const ssr = false`. Together, this means there is no server-side trust boundary at all: every `/api/*` route (create customer, create event, view all bookings, etc.) is fully reachable and writable by anyone with the URL, logged in or not.
- The "Biometric Scanner" checks `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()` only to decide whether to *show* the tab — it's a UI gate, not a security boundary.

**This is the single highest-priority fix in this entire document.** No amount of new modules matters if anyone can hit `/api/events` directly and read or write every booking, customer allergy record, or financial number with no login at all.

### 3.2 Writes silently fail and pretend to succeed
`src/routes/api/events/+server.js` (and this pattern likely repeats across the other `+server.js` files — worth auditing all of them) does this:
```js
try {
  // real DB insert
} catch (dbErr) {
  console.warn('⚠️ DB insert failed. Simulating local insert.');
  const mockEvent = { id: Math.floor(Math.random() * 1000) + 100, ...data, simulated: true };
  return json({ success: true, event: mockEvent }); // still returns success:true
}
```
If the database is briefly unreachable, the user sees a normal success message for a booking that was **never saved**. This is fine for a demo that must never visibly crash; it's dangerous for a real business (a real customer's real ₱ booking can vanish with the interface saying "saved").

### 3.3 The entire app has a silent "fantasy data" mode
`src/lib/mockData.js` (55 fake customers, fake ingredients, fake suppliers, etc.) is loaded by `+layout.js` any time the `/api/settings` call fails or doesn't return JSON — which will also happen for any static/adapter-static deployment, since `adapter-static` is already in your `devDependencies` alongside `adapter-node`. The flag `usingMockData` is returned but isn't surfaced anywhere as a visible, hard-to-miss warning banner. A business owner could be looking at 100% fictional bookings and not know it.

### 3.4 Concrete bugs to fix immediately (not gaps — actual defects)
- `ml-service/app/routes/risk.py` L34/39/45: `reasons.push(...)` — **this is JavaScript syntax in a Python file.** Python lists use `.append()`. This means `/predict/event-risk` will throw an unhandled `AttributeError` and return a 500 error every single time any risk factor is triggered (outdoor event, >180 guests, or low budget/head) — i.e., on most real inputs. It only "works" today by accident, when an event has zero risk factors.
- Secrets are hardcoded directly in source and in `docker-compose.yml` (`postgrespassword`, `postgres:postgres@localhost...` as the literal fallback default in `db.js` and `config.py`). No `.env`/`.env.example` file exists anywhere in the repo.
- Schema migrations run as inline `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` inside `db.js`, executed on every server import — not a real migration system, and it will race/duplicate-log under multiple instances.
- No automated tests exist under `src/` despite `task.md` marking "Write test suite for SvelteKit server routes" as done. Only `ml-service/tests/test_endpoints.py` exists, and it tests response shape, not correctness against real data.

---

## Part 4 — The Full Missing-Module Inventory

This is the exhaustive "list all" you asked for, organized the way you framed it — order → purchasing → inventory → booking — and then everything beyond that a real catering operation needs. Each section says *why it matters*, then lists concrete features. Priority legend: 🔴 **P0** foundational/trust · 🟠 **P1** core revenue & ops · 🟡 **P2** efficiency/scale · 🟢 **P3** advanced/competitive edge.

### A. Identity, Users, Roles & Access 🔴 P0
*Why:* Nothing else in this list is safe to build until real people, not a shared browser tab, are the unit of access.
- [ ] Real `users` table: name, email, phone, password_hash (bcrypt/argon2), role, is_active, last_login_at
- [ ] Server-side sessions or JWT, enforced via `hooks.server.js` on every route and every `+server.js` — replacing the client-only `appState.isAuthenticated`
- [ ] Roles: Owner/Admin, Sales & Bookings, Kitchen/Chef, Driver/Logistics, Accountant, Warehouse/Inventory, read-only Client
- [ ] Permission checks per role on every API route (a Driver shouldn't be able to edit financials; a Server shouldn't see supplier costs)
- [ ] Password reset via email, forced password change on first login
- [ ] Login rate-limiting / lockout after repeated failures
- [ ] `created_by` / `updated_by` columns and a real `audit_log` table (who changed what, when) — currently nothing tracks this
- [ ] Multi-branch support: a real `branches` table if you ever operate more than one kitchen/location (today `business_settings` is architecturally locked to exactly one row)
- [ ] Optional: 2FA (TOTP), Google SSO

### B. CRM & Sales Pipeline (Leads → Quotes) 🟠 P1
*Why:* Today, a `customer` only exists once you've already decided to serve them. Real sales happens *before* that — inquiries, quotes, and lost deals all matter and are currently invisible.
- [ ] `leads`/`inquiries` table distinct from `customers`, with status (New → Contacted → Quoted → Won → Lost) and lost-reason
- [ ] Public inquiry/contact intake form
- [ ] Assigned sales rep per lead and per event
- [ ] Follow-up task reminders for sales staff
- [ ] Multiple quotation options per lead (menu tiers) before they commit — not one auto-generated menu
- [ ] Quotation versioning (v1, v2, revised after client feedback)
- [ ] Win-rate / conversion-rate reporting by lead source
- [ ] Customer tagging/segmentation (VIP, corporate, recurring, referral)
- [ ] Interaction/communication timeline per customer (calls, meetings, notes) beyond the current allergy/theme fields

### C. Booking / Order Management (core) 🔴 P0 / 🟠 P1
*Why:* This is the heart of your ask. Today an "order" is really just one row in `events` plus a menu link — there's no first-class order with line items, deposits, or a real status lifecycle.
- [ ] Treat the booking as a true **order** with line items: menu package(s), à la carte add-ons, rental items, service fee, delivery fee, discount, tax — not just a single `budget` number
- [ ] Fuller status lifecycle: Inquiry → Quoted → Tentative (with hold-expiry) → Confirmed (deposit paid) → In Production → Delivered/In Service → Completed → Cancelled (with reason) / Postponed
- [ ] `event_date` split into real start/end/setup/teardown times (today it's date-only)
- [ ] Venue address + geocoordinates (needed for delivery routing *and* for the staff module's own claimed "distance_to_venue" feature, which currently has no data source at all)
- [ ] Double-booking / resource-conflict detection: same date+venue, same staff double-assigned, same equipment double-booked
- [ ] Present 2–3 tiered menu options to compare, not one generated menu
- [ ] Add-on catalog: styling, photography, AV/sound, host/emcee, welcome drinks, extra hours, corkage
- [ ] Guest-count change tracking + industry-standard "final headcount due X days before event" deadline
- [ ] Automatic allergy/ingredient cross-check: flag if a customer's recorded allergy appears in a selected menu's `ingredients_json` — the data exists on both sides today and is never cross-referenced
- [ ] Cancellation policy engine (fee % based on days-to-event)
- [ ] Reschedule workflow that preserves history
- [ ] Resource calendar (staff/vehicles/equipment), not just an events calendar
- [ ] Waitlist for fully booked dates

### D. Contracts & E-Signature 🟠 P1
*Why:* A confirmed catering booking is a legal commitment on both sides; nothing here today produces a signed agreement.
- [ ] Contract template management with clauses/T&Cs
- [ ] Auto-generated PDF contract from the order/quote data
- [ ] E-signature capture (typed or drawn) with IP + timestamp audit trail
- [ ] Contract status tracking: sent / viewed / signed
- [ ] Versioned terms acceptance log

### E. Menu, Recipe & Costing Engine 🟠 P1
*Why:* `cost_per_serving` is a static number someone types in; it should be a rollup of real ingredient costs, and menus need real structure beyond a flat list.
- [ ] Recipe-level ingredient links (structured `recipe_ingredients` rows: ingredient_id + qty + unit) instead of a free-form `ingredients_json` blob, so cost and inventory deduction can be computed, not guessed
- [ ] Auto-recalculated `cost_per_serving` from live ingredient prices, with history (so past events keep the cost that was true *then*)
- [ ] Recipe versioning (a dish's recipe changes over time; historical events should show what was actually used)
- [ ] Structured allergen tagging per ingredient/menu item (not just free-text customer allergies)
- [ ] Prep instructions/method steps for kitchen use (today there's only a single `prep_time_minutes` number)
- [ ] Seasonal availability windows per menu
- [ ] Menu photos
- [ ] Volume-based pricing tiers (per-head price drops at higher guest counts)
- [ ] Minimum guest count / minimum order per menu

### F. Inventory & Warehouse Management 🔴 P0 / 🟠 P1
*Why:* `current_stock` is a single number anyone can overwrite; there is no record of *why* it changed. This is the biggest structural gap under your explicit "inventory" ask.
- [ ] **Stock movement ledger** (`inventory_transactions`): type = receipt / consumption / waste / adjustment / transfer / return, quantity, unit cost, reference (which PO or which event consumed it), performed_by, timestamp — replacing the single mutable `current_stock` field
- [ ] Automatic stock deduction when an event's menu is confirmed, based on the real recipe (depends on Section E's structured recipe links)
- [ ] Multi-location/warehouse support (central storage vs. day-of on-site stock)
- [ ] Units-of-measure + conversion table (buy in cases/kg, consume in grams/pieces)
- [ ] Batch/lot tracking with real expiry dates per received batch (today `shelf_life_days` is one static number per ingredient, not per actual delivery)
- [ ] Automated low-stock/expiring-soon alerts tied to real thresholds (today "purchasing suggestions" is a manual screen, not a triggered alert)
- [ ] Physical stocktake / cycle-count workflow with variance reporting against system stock
- [ ] Waste logging with reason codes (spoilage, over-prep, plate waste) — this is also the real training data your food-quantity model needs
- [ ] Ingredient categories (produce, protein, dairy, dry goods) for reporting
- [ ] Separate tracking for consumable ingredients vs. reusable inventory (linens, dinnerware) — see also Section H
- [ ] Barcode/QR scanning for receiving and stocktakes (later-stage)

### G. Procurement / Purchasing 🟠 P1
*Why:* Today a purchase order is one supplier + one ingredient with no approval step and no way to check what was actually delivered against what was ordered.
- [ ] Purchase orders as real multi-line documents (header + line items) instead of one row per ingredient
- [ ] Approval workflow: Draft → Pending Approval → Approved → Sent → Partially Received → Closed
- [ ] Goods-receipt matching (three-way match: PO vs. delivery vs. supplier invoice) to catch short-shipments or price discrepancies
- [ ] Supplier price **history** (today `supplier_prices` has a unique constraint per supplier+ingredient and just overwrites `last_updated` — no trend data survives)
- [ ] Supplier performance scorecards computed from real PO history (on-time %, short-ship rate) — replacing the manually-typed static `reliability_score`
- [ ] RFQ (request-for-quotation) workflow to multiple suppliers before committing
- [ ] Return-to-vendor / short-shipment handling
- [ ] Supplier payment terms (Net 30, COD) and accounts-payable aging
- [ ] Budget-vs-actual purchasing variance reporting

### H. Equipment, Venue & Rental Asset Management 🟠 P1
*Why:* This entire category is completely absent — the schema only tracks food ingredients, never tables, chairs, tents, sound systems, or vehicles.
- [ ] Equipment/asset registry separate from food inventory (tables, chairs, linens, tents, sound systems, generators)
- [ ] Equipment booking/allocation per event with check-out/check-in and condition notes
- [ ] Equipment maintenance schedule and repair log
- [ ] Damage/loss billing back to the event or customer
- [ ] Venue registry if you serve recurring venues: capacity, kitchen access, power, parking, restrictions
- [ ] Distinguish owned inventory vs. subcontracted/third-party rental sourcing

### I. Kitchen & Production Management 🟠 P1
*Why:* The current "AI scheduler" is a fixed 4-task demo that ignores the actual menu selected — a real kitchen module needs to be driven by the real order.
- [ ] Prep lists generated from the *actual* selected menu items and their real `prep_time_minutes` (today hardcoded and ignored — see Part 2, Module 4)
- [ ] Cross-event batch planning when multiple events share kitchen capacity on the same day
- [ ] Real kitchen resource constraints (ovens, burners, fridge/freezer space) as scheduler constraints, not illustrative comments
- [ ] Food-safety/HACCP logs (temperature checks, hold times) if compliance matters in your target market
- [ ] Station assignment (grill, plating, dessert) beyond generic staff roles
- [ ] Printable or tablet-friendly kitchen tickets per station
- [ ] Real-time production status (not started / in progress / plated / loaded for delivery)

### J. Staffing & HR Operations 🟠 P1
*Why:* The "AI staff assignment" currently matches against 8 fictional names hardcoded in Python, not your real `staff` table, and has no concept of who's actually free that day.
- [ ] Wire staff assignment to the real `staff` table (this alone is a bug fix, not a new feature)
- [ ] Staff availability calendar / leave requests — currently there's no way to know if someone is already double-booked
- [ ] Time & attendance clock-in/out per event, reconciled against `hours_assigned`
- [ ] Payroll computation (regular/overtime/holiday rates) and export
- [ ] Staff certifications (food handling, driver's license) with expiry reminders
- [ ] Post-event staff performance notes — this is also the real training data a future recommender would need
- [ ] Shift swap / backup staff handling on last-minute cancellation
- [ ] Support for staff who can fill multiple roles (e.g., Server + Bartender)

### K. Delivery & Logistics 🟡 P2
*Why:* Completely absent today — there's no vehicle, driver, or route concept anywhere in the schema.
- [ ] Vehicle fleet registry (capacity, plate number, maintenance due)
- [ ] Delivery/route assignment per event (driver, vehicle, departure time, ETA)
- [ ] Distance/route estimate via a maps/geocoding integration (also needed by Section C's venue-distance gap)
- [ ] Delivery checklist and proof-of-delivery (photo/signature/timestamp)
- [ ] Return-trip logistics for post-event equipment pickup
- [ ] Multi-drop routing for same-day multiple small orders

### L. Billing, Invoicing & Payments 🔴 P0 / 🟠 P1
*Why:* There is currently no money-collection concept at all beyond a single `budget` field — no invoice, no deposit, no recorded payment, no tax. For a real business this is as urgent as authentication.
- [ ] Quotation → invoice conversion with real itemized lines, discounts, service charge, and tax
- [ ] Deposit / payment-schedule support (e.g., 50% down at booking, balance due N days before event)
- [ ] Payment recording: cash, bank transfer, card, e-wallet (GCash/Maya are worth a direct look given your ₱ currency)
- [ ] Payment gateway integration (PayMongo, Stripe, or PayPal) for online deposits
- [ ] Receipt generation (PDF — this is also a great fit for your existing "ticket/receipt" visual theme)
- [ ] Refund and cancellation-fee computation tied to your cancellation policy (Section C)
- [ ] Accounts-receivable aging and overdue-payment reminders
- [ ] Discount codes / promotional pricing
- [ ] Tax handling (VAT/withholding tax) — zero tax fields exist anywhere in the schema today

### M. Accounting & Financial Reporting 🟡 P2
*Why:* The current "Profit Analyzer" is random numbers (Part 2); real financial reporting needs to be built on real transactions, not simulated ones.
- [ ] Chart of accounts
- [ ] Automatic journal entries from real operational transactions (event revenue, COGS from inventory consumption, payroll, purchasing)
- [ ] Real P&L and balance sheet, computed from actual data — this *replaces* the fake Isolation Forest output, not adds to it
- [ ] Non-event expense tracking (rent, utilities, marketing)
- [ ] Export/integration with QuickBooks, Xero, or local BIR-compliant receipting if relevant to your market
- [ ] Business-wide budgeting and variance analysis (today cost analysis is per-event only, and fake)

### N. Customer Communications & Notifications 🟠 P1
*Why:* The current "notifications" system is a browser push-notification demo (`Notification.requestPermission()`), not connected to any real business trigger.
- [ ] Real transactional email (booking confirmation, invoice, payment reminder, event-day reminder) via a provider (Resend, SendGrid)
- [ ] SMS reminders via a gateway (Semaphore/Twilio) — high-value in the Philippine market specifically
- [ ] Rule-based automated reminders: headcount due, balance due, event tomorrow
- [ ] Real internal staff alerts (new booking assigned, schedule changed) tied to actual events — not the current simulated periodic demo ping
- [ ] Editable notification templates
- [ ] Communication log per customer (what was sent, when, opened)

### O. Customer Self-Service Portal 🟡 P2
*Why:* Right now the customer has no way to interact with their own booking at all — everything is operator-only.
- [ ] Client login to view their own quote, invoice, and contract
- [ ] Online menu browsing and selection (useful when multiple stakeholders need to agree, e.g., a couple planning a wedding)
- [ ] Online deposit/payment
- [ ] E-signature acceptance
- [ ] Event countdown / status tracker for the client

### P. Reviews, Feedback & Post-Event Follow-up 🟡 P2
- [ ] Post-event survey/rating capture
- [ ] Testimonial collection and display
- [ ] Complaint/ticket handling workflow
- [ ] Repeat-booking incentives for past customers

### Q. Reporting & Business Intelligence 🟡 P2
*Why:* Current dashboards show either real-but-basic CRUD lists or fabricated AI numbers; there's no cross-cutting reporting layer.
- [ ] Exportable reports (CSV/PDF) across all major entities
- [ ] Custom date-range filtering
- [ ] Revenue by event type/theme/month, margin trends, top customers, top menus, staff utilization, supplier spend — computed from real transactions once Sections L/M exist
- [ ] Saved custom report views (later-stage)

### R. Real AI/ML — Rebuilding the 9 Modules Properly 🟠 P1 / 🟡 P2
*Why:* Part 2 already showed exactly what's fake. This section is the fix list, plus genuine next steps once real data is flowing.
- [ ] **Highest-leverage single fix:** reconnect every module to the real database instead of hardcoded Python fixtures (`DEFAULT_MENUS`, `DEFAULT_STAFF`, the modulo-based recommender, the random-seeded profit numbers)
- [ ] Actually run `train_quantity_model.py` and `train_sales_forecast.py` against accumulated real data, save the `.pkl` output where `model_loader.py` expects it, and schedule periodic retraining
- [ ] Build the training scripts that don't exist yet: Random Forest for staff-count prediction, Logistic Regression for risk, Isolation Forest for profit anomalies
- [ ] Fix the `reasons.push()` crash in `risk.py` (Part 3.4) — this blocks the module from working at all today
- [ ] Replace the recommender's modulo trick with real cosine similarity over customer/menu history vectors
- [ ] Make the kitchen scheduler consume the real selected dishes' `prep_time_minutes` instead of a fixed 4-task demo
- [ ] Surface `model_source`/confidence honestly in the UI (the backend already labels heuristic-fallback outputs — that label just needs to reach the screen)
- [ ] Once 1-3 above are in place and real data accumulates: demand-based dynamic pricing, ingredient price forecasting, lead-conversion/no-show prediction, and the two stretch goals your own `plan.md` already names (buffet computer-vision consumption estimation, association-rule upsell mining)

### S. Integrations 🟡 P2
- [ ] Payment gateway (PayMongo/Stripe/PayPal)
- [ ] Email + SMS providers
- [ ] Calendar sync (Google/Outlook) for bookings and staff schedules
- [ ] Accounting software export
- [ ] Maps/geocoding for venue distance and delivery routing
- [ ] Cloud object storage for contracts, signed documents, event photos

### T. Mobile / Field Operations 🟡 P2
*Why:* `manifest.json` and `service-worker.js` exist, so PWA installability is started — but none of the field workflows a catering crew actually needs on-site exist yet.
- [ ] Kitchen tablet view (today's/tomorrow's prep list only)
- [ ] Driver delivery view (today's route, proof-of-delivery capture)
- [ ] On-site event-day checklist for coordinators
- [ ] Real offline queuing + sync (today's "offline mode" is fake data, not a real offline-write queue)
- [ ] Push notifications tied to real triggers (delivery ready, payment received) instead of the current cosmetic demo

### U. Compliance, Security & Data Protection 🔴 P0 / 🟠 P1
- [ ] Everything in Section A (this is the same problem, restated at the policy level)
- [ ] Encryption in transit/at rest; remove hardcoded DB credentials from source and `docker-compose.yml`
- [ ] Automated backups and a real disaster-recovery plan for the Postgres volume
- [ ] Login rate-limiting/brute-force protection
- [ ] Data-retention and consent policy for sensitive fields you already store (allergies, dietary info) — worth a look at the Philippine Data Privacy Act (RA 10173) given your market
- [ ] SQL-injection audit (you're already using parameterized `pg` queries in the routes I checked — good — but worth confirming across all of them as new ones are added)

### V. DevOps, Testing & Platform Engineering 🔴 P0 / 🟠 P1
- [ ] A real automated test suite for SvelteKit routes (claimed done in `task.md`; doesn't exist)
- [ ] Expand ML-service tests to assert correctness against real data, not just response shape
- [ ] CI/CD pipeline (lint/test/build/deploy) — none exists today
- [ ] Real migration tooling (e.g., `node-pg-migrate`, Prisma Migrate) replacing the inline `ALTER TABLE IF NOT EXISTS` in `db.js`
- [ ] `.env`/`.env.example` and proper secrets management
- [ ] Structured logging/error monitoring (e.g., Sentry) replacing scattered `console.warn`
- [ ] Health-check/monitoring endpoints
- [ ] Remove or clearly surface (never silently hide) the "fake success on DB failure" pattern in every `+server.js` route
- [ ] Deliberately decide on SSR: re-enable it once Section A adds a real server trust boundary — right now `ssr=false` forfeits the one place that boundary would naturally live

---

## Part 5 — Consolidated New Database Tables (quick reference)

Grouped by the section above that motivates them. This is meant as a build checklist, not final DDL.

| Domain | New Tables |
|---|---|
| A. Identity & Access | `users`, `roles`, `permissions`, `role_permissions`, `audit_log`, `branches` |
| B. CRM & Sales | `leads`, `lead_activities`, `quotations`, `quotation_items`, `quotation_versions` |
| C. Booking/Orders | `order_items` (menu/add-on/rental/fee lines), `order_status_history`, `resource_holds` |
| D. Contracts | `contracts`, `contract_signatures` |
| E. Menu/Recipe | `recipe_ingredients`, `menu_item_steps`, `allergen_tags`, `menu_item_allergens`, `menu_cost_history` |
| F. Inventory | `inventory_transactions`, `inventory_locations`, `units_of_measure`, `unit_conversions`, `stock_batches`, `stocktakes`, `stocktake_lines`, `waste_logs` |
| G. Purchasing | `purchase_order_headers`, `purchase_order_lines`, `goods_receipts`, `supplier_price_history`, `supplier_performance_snapshots`, `rfqs` |
| H. Equipment/Venue | `equipment_assets`, `equipment_bookings`, `equipment_maintenance_logs`, `venues` |
| I. Kitchen | `kitchen_tasks`, `production_status_logs`, `haccp_logs` |
| J. Staffing | `staff_availability`, `staff_time_logs`, `staff_leave_requests`, `staff_certifications`, `payroll_runs`, `payroll_lines` |
| K. Logistics | `vehicles`, `delivery_routes`, `delivery_stops`, `proof_of_delivery` |
| L. Billing | `invoices`, `invoice_lines`, `payments`, `payment_methods`, `refunds`, `payment_schedules` |
| M. Accounting | `chart_of_accounts`, `journal_entries`, `journal_lines`, `expenses` |
| N. Comms | `notifications_log`, `communication_log`, `notification_templates` |
| O/P. Portal/Feedback | `reviews`, `support_tickets` |
| R. Real AI | `model_registry`, `prediction_accuracy_logs` (extends what `demand_forecasts`/`risk_flags` already started) |

---

## Part 6 — Recommended Build Order

Not a rigid week-by-week plan — a priority order so you're not doing everything "critical" at once.

**Phase 0 — Trust & Foundation (blocks everything else)**
Section A (real auth/RBAC) · Section U (secrets, backups) · Section V (tests, migrations, remove fake-success writes) · fix the `risk.py` crash and the other Part 3 bugs.

**Phase 1 — Real Revenue Core**
Section C (real order/line-items/status lifecycle) · Section L (invoicing/payments/deposits) · Section D (contracts) · Section B (leads/quotes).

**Phase 2 — Real Operations**
Section F (inventory ledger) · Section G (multi-line PO + approvals) · Section E (recipe costing) · Section H (equipment/venue) · Section I (kitchen) · Section J (staffing tied to real data) · Section K (logistics).

**Phase 3 — Make the AI Actually AI**
Section R in full — this is where the original capstone's 9 modules get reconnected to real data and become trustworthy enough to hand decisions to.

**Phase 4 — Scale & Polish**
Section M (accounting) · Section N/O/P (comms, portal, reviews) · Section Q (BI/reporting) · Section S (integrations) · Section T (mobile/field) · multi-branch from Section A.

---

## Closing Notes

Two architecture decisions are worth making deliberately, early, rather than by default:
1. **Keep the Python FastAPI microservice, but give it its own DB connection for live serving** (today only the offline training scripts import `psycopg2` — the serving routes never do). Once that's wired, most of Part 2's fixes become "swap a hardcoded list for a query," not a rewrite.
2. **Re-enable SSR once Section A lands.** `ssr=false` was a reasonable simplification for a capstone demo; it's actively working against you once real authentication needs a server-enforced boundary.

This document intentionally goes wide rather than picking favorites, per your ask to "list all." If you want, I can take any single section above (most naturally Section F/Inventory, Section C/Orders, or Section A/Auth, since those block the most other work) and turn it into an actual schema + API + UI implementation plan next.
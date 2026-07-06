# CaterSync-AI — Modernization & Completion Plan

The design system is genuinely good — keep it. Almost nothing wired to it is real yet. This is the full gap list plus the build order to close it: icons, table pagination, the missing Settings module, and reconnecting the AI backend that already exists but isn't plugged in.

---

## 1. Reality check

`task.md` has all 7 phases checked off. Here's what the code in `src/routes/+page.svelte` actually does, module by module:

| # | Module | `task.md` claims | What's actually in the code |
|---|---|---|---|
| 1 | Food Quantity Prediction | ✅ XGBoost endpoint wired | `handlePredictQuantities` (line 327) — `setTimeout` + a hardcoded multiplier table (`0.42`, `0.49`, `0.35`) |
| 2 | Menu Generator | ✅ PuLP ILP wired | `handleGenerateMenu` (line 274) — picks `liveDraftMenu`, no optimizer call |
| 3 | Ingredient Purchasing (EOQ) | ✅ EOQ wired, "Approve and Order" button | The two EOQ cards in the Inventory tab are static HTML with no backing function at all. "Approve restock tickets" has no `onclick`. |
| 4 | Kitchen Scheduler | ✅ OR-Tools CP-SAT wired | `runKitchenScheduler` (line 383) — same fixed 6-row array every time |
| 5 | Staff Assignment | ✅ Hungarian algorithm wired | `runStaffAssignment` (line 410) — fixed names, `serverCount = Math.ceil(guestCount / 35)` |
| 6 | Profit Analyzer | ✅ Isolation Forest wired | `runProfitAnalysis` (line 444) — `Math.random()` for cost ratios, `overhead = rev * 0.12` hardcoded |
| 7 | Customer Preference Learning | ✅ Cosine similarity wired | `loadCustomerPreferences` (line 241) — a few `if` statements adding/subtracting 0.25–0.85 |
| 8 | Event Risk Prediction | ✅ Logistic Regression wired | `handleCheckRisks` (line 348) — additive score, thresholds hardcoded at `> 0.6` / `> 0.35` (lines 369, 373) |
| 9 | Sales Forecasting | ✅ Prophet/SARIMA wired, chart built | `demandForecasts` loads real data, but the chart itself (line 774) is a hand-drawn SVG `<path>`, not plotted from it |

The FastAPI service backing all nine (`ml-service/app/routes/*.py`) is real — genuine PuLP, OR-Tools CP-SAT, scipy Hungarian matching, Isolation Forest, Prophet, cosine similarity. `src/lib/server/mlClient.js` is a complete, correctly-written client for every one of those nine endpoints. **It's never imported anywhere in the project.** `docker-compose.yml` even sets `ML_SERVICE_URL` correctly for the frontend container. Both ends are fully built; the middle was never connected. That's the single highest-value fix in this whole plan — see §7.

Two more things worth knowing before touching anything else:
- The three "Tickets Firing Now" cards on the dashboard (Event #048 risk, Chicken Breast stock warning, Sous Chef double-booking) are hardcoded strings — not derived from the real `events` / `ingredients` / `staff` data that's already loaded into the page.
- "LEDGER CLOCK: 2026-07-06 13:07" in the header is a static string, not a clock.

## 2. What's already good — don't rebuild this

- **The "Ticket/Ledger" identity is a real design system**, not a template default: Paper/Ink/Basil/Saffron/Paprika/Steel tokens, Fraunces/Public Sans/IBM Plex Mono, the scalloped `.ticket-card` component with its perforated-edge gradient. It's properly implemented in `layout.css`, not just described in `ui.md`.
- **The DB schema is solid** — 15 tables, real `CHECK` constraints, sensible FK cascade rules, `updated_at` triggers. Good ground to build Settings CRUD on top of.
- **Accessibility floor is already there** — `focus-visible` rings, a real `prefers-reduced-motion` block that isn't just decorative.
- **The FastAPI ML service is genuinely implemented**, not stubbed — confirmed by reading the PuLP formulation in `menu.py` directly.

None of this needs to be scrapped for the "modernize" ask. It needs to be finished and connected — that's a different job than a redesign, and a faster one.

## 3. Full module map

Everything a catering ops tool needs, and where each one currently stands.

| Module | Status | Notes |
|---|---|---|
| Dashboard / Overview | 🟡 Partial | Layout is right; the urgent-items cards and forecast chart are static, not computed |
| Event Planner | 🔴 Fake AI | Real UI, all 3 sub-modules (menu gen, quantity, risk) run on hardcoded formulas |
| Customers | 🟢 Working | Create + list + search work; no edit/delete, no pagination |
| **Menus & Recipes** | 🔴 Missing as a module | 4 menus hardcoded in `+page.server.js`; `menu_items` table exists in the DB and is never touched by any route |
| Inventory / Ingredients | 🟡 Read-only | Table renders from real data; no add/edit form, no API route |
| **Suppliers** | 🔴 Missing entirely | No tab, no table, no form — only referenced as plain text inside a hardcoded EOQ card |
| Purchasing / Purchase Orders | 🔴 Fake | `purchase_orders` table is defined and seeded but no route ever reads or writes it |
| **Staff / Workers roster** | 🔴 Missing as CRUD | Only exists as static mock data; no add/edit/deactivate anywhere |
| Kitchen Scheduling | 🔴 Fake | Real OR-Tools solver exists server-side, unused |
| Anomaly Audits / Profit | 🔴 Fake | Real Isolation Forest exists server-side, unused |
| Sales Forecast | 🟡 Partial | Real data loaded, decorative chart |
| **Settings** | 🔴 Missing entirely | Zero references anywhere in the repo — see §4 |
| Notifications | 🟡 Ephemeral only | Toasts vanish after 3.5s; no history/center |
| Auth / Users / Roles | 🔴 Missing | No `users` table, no login — flagged as a scope decision in §9, not assumed |

🟢 working · 🟡 partial/fake data · 🔴 missing

## 4. Settings module — the explicit ask

This is the module you said you can't configure anything through, and the audit backs that up: there is no settings anywhere in the codebase, and the hardcoded business rules below are exactly the kind of numbers a Settings screen should own instead of a `.svelte` file.

**Hardcoded values that should be settings, not code** (found while reading `+page.svelte`):

| Value | Location | Should become |
|---|---|---|
| `₱` currency symbol | 15 places | `business_settings.currency_symbol` |
| `overhead = rev * 0.12` | line 451 | `business_settings.overhead_rate` |
| `budget < guestCount * 150` | line 284 | `business_settings.min_budget_per_guest` |
| `riskScore > 0.6` / `> 0.35` | lines 369, 373 | `business_settings.risk_high_threshold` / `risk_medium_threshold` |

### Proposed schema addition

```sql
-- Singleton row holding business-wide configuration
CREATE TABLE business_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    business_name VARCHAR(255) NOT NULL DEFAULT 'CaterSync',
    currency_symbol VARCHAR(5) NOT NULL DEFAULT '₱',
    overhead_rate NUMERIC(5,4) NOT NULL DEFAULT 0.12 CHECK (overhead_rate BETWEEN 0 AND 1),
    min_budget_per_guest NUMERIC(10,2) NOT NULL DEFAULT 150.00,
    risk_medium_threshold NUMERIC(3,2) NOT NULL DEFAULT 0.35,
    risk_high_threshold NUMERIC(3,2) NOT NULL DEFAULT 0.60,
    low_stock_alerts_enabled BOOLEAN NOT NULL DEFAULT true,
    sound_enabled_default BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- So removing a worker never silently deletes their assignment history
-- (staff_assignments currently has ON DELETE CASCADE on staff_id)
ALTER TABLE staff ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
```

### Settings sub-sections needed

| Section | Backs onto | Fields / actions |
|---|---|---|
| **Business Profile** | new `business_settings` | Business name, currency symbol, overhead rate, min budget/guest, risk thresholds |
| **Workers** | `staff` (+ `is_active`) | List with pagination; add/edit name, role (dropdown: Chef / Sous Chef / Server / Bartender / Coordinator — matches the existing DB `CHECK`), hourly rate, max hours/week; deactivate instead of delete |
| **Food Menus & Recipes** | `menus` + `menu_items` | Add/edit/delete menu (name, category, cost & price per serving, cuisine tags); per menu, add/edit/delete dishes (name, ingredients list, prep time) |
| **Inventory Items** | `ingredients` | Add/edit ingredient (name, unit, current stock, reorder point, shelf life); manual stock adjustment with a reason logged |
| **Suppliers** | `suppliers` + `supplier_prices` | Add/edit supplier (name, reliability score, lead time); price matrix — set price per ingredient per supplier |
| **Notifications** | `business_settings` | Toggle low-stock alerts, sound default, adjust risk thresholds from the table above |
| **Data** *(optional, low priority)* | — | "Reset to demo data" / "Using live DB vs. simulation" indicator, surfacing the existing `usingMockData` flag that already sits unused in the UI |

## 5. Icon system

Zero icon library is installed today (`package.json` dependencies: only `pg`). Every "icon" in the app is an emoji character — nav tabs, buttons, search boxes, status badges (37 occurrences across the file). That's what reads as "keyboard icons" instead of a designed icon set, and it's an easy, high-visibility fix.

**Recommendation: `@lucide/svelte`** (`npm i @lucide/svelte`) — this is the Svelte-5-specific Lucide package (the older `lucide-svelte` targets Svelte 3/4 only, and this project is on Svelte 5.56). Outline-style, consistent stroke weight, tree-shakable per-icon imports, and it reads well against the mono/ledger aesthetic already in place — set `stroke-width` and `color` from the existing CSS variables (`--color-basil`, `--color-paprika`, etc.) rather than Lucide's defaults, so icons look like part of this design system, not a bolted-on library.

| Current | Where | Replace with |
|---|---|---|
| 📋 | Overview nav tab | `LayoutDashboard` |
| 🍽️ | Event Planner nav tab / Menu station | `UtensilsCrossed` |
| 👥 | Customers nav tab / station | `Users` |
| 📦 | Inventory nav tab / station | `Package` |
| 🍳 | Kitchen & Roster nav tab | `ChefHat` |
| 💰 | Anomaly Audits nav tab / profit toast | `Wallet` |
| 🔈 / 🔇 | Sound toggle | `Volume2` / `VolumeX` |
| 🔍 | Search inputs (customers, inventory) | `Search`, positioned inside the input, not typed into the placeholder text |
| ⚠️ | Risk toasts, anomaly banner | `AlertTriangle` |
| ✅ / ❌ | Success / error states | `CheckCircle2` / `XCircle` |
| ⚖ | Quantity prediction toast | `Scale` |
| 🧑‍🤝‍🧑 | Staff match toast | `UserCheck` |

**New icons this plan needs that don't have an emoji today:** `Settings` (gear — `ui.md`'s own wireframe shows `[Owner ⚙]` in the header and it was never built), `Plus` (add), `SquarePen` (edit), `Trash2` (delete/deactivate), `ChevronLeft` / `ChevronRight` (pagination), `ArrowUpDown` (sortable columns), `Truck` (suppliers), `TrendingUp` (forecast), `Clock` (schedule).

## 6. Tables — pagination and a shared standard

Every list in the app renders unbounded right now:

- Customers: `{#each filteredCustomers as c}` — no limit, will render all 55+ rows
- Inventory: `{#each filteredIngredients as ing}` — same
- Audit ledger: capped only by a `max-h-96 overflow-y-auto` scroll box, not real pagination

Build one `DataTable.svelte` and use it everywhere instead of hand-copying `<table>` markup per tab (which is the current pattern, and part of why the file is 1,400+ lines).

```
DataTable props:
  rows              — array of row objects
  columns           — [{ key, label, align?, sortable? }]
  rowKey            — field to key each row on, e.g. 'id'
  pageSizeOptions   — [10, 25, 50, 100]
  defaultPageSize   — 10
  searchableKeys    — which fields the search box matches against
  emptyMessage      — shown when rows is empty (an empty state, not a blank table)
  loading           — shows the existing .skeleton-shimmer rows instead of data
```

Client-side slicing is fine at this data volume (55 customers, 30–110 events, ~15 ingredients today) — no need for server-side `LIMIT`/`OFFSET` unless a table grows past roughly 1,000 rows. Footer shows "Showing 1–10 of 55" plus prev/next and the page-size dropdown, using the `ChevronLeft`/`ChevronRight` icons from §5. Apply it to Customers and Inventory immediately, then to Menus, Suppliers, Staff, and Purchase Orders as those screens get built in §4.

## 7. Wire the real AI backend

This is the fix that matters most because the work is already done — it's a connection problem, not a build problem.

1. Add one `+server.js` proxy route per module under `src/routes/api/ai/`, each just calling the matching method already written in `mlClient.js`:

   ```
   api/ai/menu-generation/+server.js       → mlClient.generateMenu(...)
   api/ai/food-quantity/+server.js         → mlClient.predictFoodQuantity(...)
   api/ai/ingredient-purchasing/+server.js → mlClient.calculateIngredientPurchasing(...)
   api/ai/kitchen-schedule/+server.js      → mlClient.generateKitchenSchedule(...)
   api/ai/staff-assignment/+server.js      → mlClient.optimizeStaffAssignment(...)
   api/ai/profit-analysis/+server.js       → mlClient.analyzeProfitAnomaly(...)
   api/ai/customer-preferences/+server.js  → mlClient.recommendCustomerPreferences(...)
   api/ai/event-risk/+server.js            → mlClient.predictEventRisk(...)
   api/ai/sales-forecast/+server.js        → mlClient.fetchSalesForecast()
   ```

2. Replace the seven fake handler functions with real `fetch` calls to those routes, keeping the loading states / skeletons / toasts that already exist — that part of the interaction design is good and doesn't need to change, only what fills it in:

   `handleGenerateMenu` (274), `handlePredictQuantities` (327), `handleCheckRisks` (348), `runKitchenScheduler` (383), `runStaffAssignment` (410), `runProfitAnalysis` (444), `loadCustomerPreferences` (241).

3. Give the Inventory tab's EOQ cards and "Approve restock tickets" button an actual function: call `/api/ai/ingredient-purchasing`, render whatever it returns instead of the two static cards, and have the button insert a row into `purchase_orders` via a new API route.

No trained model files exist yet (`model_loader.py` falls back to heuristics gracefully when a `.pkl` is missing), so this works immediately without training anything — training real models on `consumption_logs` is a separate, later improvement, not a blocker for wiring the connection itself.

## 8. Architecture — split the monolith

Everything currently lives in one 1,416-line file: 552 lines of script, then six `{#if activeTab === '...'}` blocks stacked in the markup, with nav buttons that just flip a string instead of navigating. That's workable at 6 tabs; it won't be at 11+ modules plus Settings. Splitting this is what actually makes "every element that needs a feature must have it" sustainable, rather than one more thing bolted onto a single file.

```
src/routes/
├── +layout.svelte          # NEW — header + nav move here, shared across all pages
├── +page.svelte            # Overview/Dashboard only, trimmed way down
├── planner/+page.svelte
├── customers/+page.svelte
├── menus/+page.svelte              # NEW
├── inventory/+page.svelte
├── suppliers/+page.svelte          # NEW
├── staff/+page.svelte               # NEW
├── scheduling/+page.svelte
├── audits/+page.svelte
├── settings/
│   ├── +page.svelte                 # NEW — settings home
│   ├── business/+page.svelte
│   ├── workers/+page.svelte
│   ├── menus/+page.svelte
│   ├── inventory/+page.svelte
│   └── suppliers/+page.svelte
└── api/
    ├── customers/+server.js         # extend: GET/PATCH/DELETE
    ├── events/+server.js            # extend: GET/PATCH/DELETE
    ├── menus/+server.js             # NEW
    ├── ingredients/+server.js       # NEW
    ├── suppliers/+server.js         # NEW
    ├── staff/+server.js             # NEW
    ├── purchase-orders/+server.js   # NEW
    ├── settings/+server.js          # NEW
    └── ai/…                         # see §7
```

Extract into `src/lib/components/`: `TicketCard.svelte`, `StationCard.svelte`, `AlertBadge.svelte`, `DataTable.svelte`, `GanttTimeline.svelte`, `ForecastChart.svelte` — each currently exists only as copy-pasted markup inline.

## 9. Fix the fake/dead elements

Once real data is flowing through Settings (§4) and the AI routes (§7), these become straightforward:

- Dashboard "Tickets Firing Now" — compute from real state instead of the three hardcoded cards: ingredients below `reorder_point`, upcoming outdoor events, overlapping `staff_assignments`.
- Forecast chart (line 774) — plot the actual `<path>` from `demandForecasts` points instead of the fixed decorative curve.
- Header clock — either make it live (`setInterval`, one line) or drop it; a static clock reading the literal current date is a strange thing to keep once noticed.

## 10. Suggested build order

Structured as small, scoped chunks — matches how you're already running the Medy project through Claude Code.

| Phase | Scope | Why this order |
|---|---|---|
| **0** | Split the monolith into routes + shared layout (§8); extract `TicketCard`/`StationCard`/`AlertBadge` as components. No behavior changes. | Everything after this is easier to scope and review individually once it isn't all one file |
| **1** | Install `@lucide/svelte`, swap every emoji (§5); build `DataTable.svelte` and apply to Customers + Inventory (§6) | Fastest visible "modernize" win, low risk, no schema changes |
| **2** | `business_settings` table + `staff.is_active` column; new CRUD API routes; Settings module and its five sub-pages (§4) | The explicit ask — workers, menus, inventory, suppliers all become configurable |
| **3** | Nine `api/ai/*` proxy routes; replace the seven fake handlers; wire EOQ + "Approve restock tickets" (§7) | Highest-value fix — connects work that's already fully built on both ends |
| **4** | Dashboard tickets, forecast chart, header clock — all driven by real data now available (§9) | Needs Phase 2/3's real data to compute from |
| **5** *(optional)* | Auth/`users`/roles if this stops being single-owner; persistent notification center; CSV/PDF export | Scope decision, not a gap — flagging it rather than assuming it in or out |

---

## Everything currently lacking — flat list

- [ ] No pagination or row limits on any table (Customers, Inventory, Audit ledger)
- [ ] No icon library — 37 emoji used as icons across nav, buttons, badges, search
- [ ] No Settings module at all — can't configure workers, menus, inventory, or suppliers
- [ ] No Suppliers screen of any kind (tab, table, or form)
- [ ] No CRUD for menus, ingredients, suppliers, or staff — only Customers and Events can be created, and neither can be edited or deleted
- [ ] All 9 "AI" modules run on hardcoded/random client-side formulas; the real FastAPI ML service and its ready-made client (`mlClient.js`) are never called
- [ ] "Approve restock tickets" button has no click handler
- [ ] Dashboard's urgent-items cards are hardcoded, not computed from real data
- [ ] Forecast chart is a decorative static path, not plotted from `demandForecasts`
- [ ] Header clock is a static string
- [ ] Business rules (currency symbol, overhead rate, min budget/guest, risk thresholds) are hardcoded in the UI instead of configurable
- [ ] Whole UI lives in one 1,416-line file with no route structure to hang new modules on
- [ ] No authentication, users, or roles (flag for a decision, not assumed as required)
- [ ] No persistent notification history — toasts disappear after 3.5s
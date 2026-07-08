# CaterSync AI → Marketplace Platform: Implementation Plan

**Goal:** turn the current single-tenant CaterSync-AI app into the multi-tenant, Grab/Foodpanda-style marketplace described in your plan overview — Platform Admin, Catering Organizations, Customers, Suppliers (Event Partners later) — without throwing away the work already done.

**Method:** I re-inspected the actual repo (not just `added-plan.md`) before writing this. Key finding that changes the starting point of this plan:

> **Your schema and auth are further along than the marketplace vision assumes.** `db/schema.sql` already has 78 tables — `users`, `roles`, `permissions`, `role_permissions`, `subscriber_accounts`, `webauthn_credentials`, `branches`, `invoices`, `payments`, `inventory_transactions`, etc. all exist. `src/hooks.server.js` exists. Auth routes exist for operator login, subscriber (customer) login, Google SSO, WebAuthn, OTP/TOTP. **None of it is tenant-aware.** Every table is scoped to exactly one business, globally. That is the actual gap this document closes — not "build auth from scratch," but "add a tenant boundary to the auth and data layer you already have, then build the three new portals on top of it."

I verified this directly: there is no `organizations`/`tenants` table anywhere in `schema.sql`, no `tenant_id`/`org_id` column on any of the 78 tables, `src/routes/+layout.js` still does one global `Promise.all` fetch of customers/events/menus/etc. with no org scope, and `business_settings`-style singleton assumptions are baked into how `settings` loads. Suppliers today are a table caterers manage internally (`suppliers`, `supplier_prices`) — not a party that logs in. There's also no `platform_admin` concept distinct from a regular operator `role`.

That reframes the work into four buckets, in dependency order:

1. **Tenant foundation** — the one piece everything else depends on
2. **Four-portal auth** — Platform Admin / Org / Customer-marketplace / Supplier-marketplace
3. **Marketplace surface** — public discovery, cross-org booking flow, supplier↔org commerce
4. **Billing & platform ops** — subscriptions, commissions, platform analytics

---

## Part 1 — Architecture Decision: How Multi-Tenancy Actually Gets Implemented

Before touching code, lock in these four decisions. Getting them wrong costs weeks later.

### 1.1 Tenant isolation model: **shared database, `organization_id` column** (not separate DBs/schemas per tenant)

Given your stack (single Postgres via `pg` Pool, Cloudflare/Node adapters, capstone timeline), per-tenant databases or schemas is over-engineering. Use one database, add `organization_id BIGINT` to every business-scoped table, and enforce isolation at the query layer. This is what Shopify, Notion, and most real SaaS platforms do at your stage. Revisit only if a specific enterprise customer later demands physical isolation.

### 1.2 Where isolation is enforced: **`hooks.server.js` resolves tenant context on every request; every server route filters by it explicitly**

Don't rely on Postgres Row-Level Security alone (it's a good *defense-in-depth* layer to add in Phase 4, not your first line of defense, since your `pg` pool likely uses one shared role). The pattern:

```js
// src/hooks.server.js (extend what's already there)
export async function handle({ event, resolve }) {
  const session = await resolveSession(event); // your existing session/JWT logic
  event.locals.user = session?.user ?? null;

  // NEW: resolve tenant context based on user type
  if (session?.user?.type === 'platform_admin') {
    event.locals.tenantId = null; // platform admin is cross-tenant
  } else if (session?.user?.type === 'org_user') {
    event.locals.tenantId = session.user.organization_id; // hard-bound, not client-supplied
  } else if (session?.user?.type === 'subscriber') {
    event.locals.tenantId = null; // customers browse across orgs
  } else if (session?.user?.type === 'supplier') {
    event.locals.tenantId = null; // suppliers serve multiple orgs
  }

  return resolve(event);
}
```

Every `+server.js` under `/api/org/**` then does `WHERE organization_id = $1` using `locals.tenantId` — **never** a value read from the request body or query string. This is the #1 place tenant-isolation bugs happen (trusting a client-supplied `org_id`), so treat it as a hard rule across the whole codebase.

### 1.3 Three site "modes," not one app with a role switch

Today everything lives under one route tree assuming one business. Split into route groups so each persona gets its own shell, nav, and layout data — this also lets you deploy/cache them differently later:

```
src/routes/
  (marketplace)/          ← public + customer-facing, SSR ON, SEO-friendly
    +layout.svelte
    +page.svelte                     # landing: search caterers
    caterers/[slug]/+page.svelte     # public org storefront
    caterers/[slug]/book/+page.svelte
    bookings/+page.svelte            # customer's own bookings (auth required)
  (org)/                  ← existing app, becomes tenant-scoped
    [orgSlug]/
      dashboard/+page.svelte
      bookings/+page.svelte          # was planner/
      inventory/+page.svelte
      suppliers/+page.svelte
      ...(your existing 9 pages, moved here)
  (admin)/                ← new, platform-admin only
    admin/
      dashboard/+page.svelte
      organizations/+page.svelte
      organizations/[id]/+page.svelte
      subscriptions/+page.svelte
      support/+page.svelte
  (supplier)/              ← new
    supplier/
      dashboard/+page.svelte
      products/+page.svelte
      purchase-orders/+page.svelte
```

`ssr = false` at the root today blocks all of this — see 1.4.

### 1.4 Re-enable SSR, at least for the marketplace and admin route groups

`export const ssr = false` in `src/routes/+layout.js` was fine for a single internal dashboard. It's disqualifying for a public marketplace (`(marketplace)`) that needs to be crawlable/shareable (a customer sharing a caterer's storefront link needs it to render without JS for previews, and Google needs to index it). Minimum change:
- Remove the blanket `export const ssr = false` from the root layout.
- Add `export const ssr = true` (default) to the `(marketplace)` group.
- You can keep `ssr = false` on the `(org)` internal dashboard group if you want to preserve current behavior there, but now that `hooks.server.js` exists and does real auth, there's no strong reason not to enable it everywhere — SSR is what makes the tenant boundary trustworthy instead of client-decorative.

---

## Part 2 — Phase 1: Tenant Foundation (do this first, everything else blocks on it)

### 2.1 New tables

```sql
-- =========================================================================
-- ORGANIZATIONS (tenants) — the catering businesses on the platform
-- =========================================================================
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(100) UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),
    name VARCHAR(255) NOT NULL,
    logo_url TEXT,
    cover_image_url TEXT,
    description TEXT,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),
    service_areas TEXT[] DEFAULT '{}'::TEXT[],       -- cities/regions served, for marketplace search
    min_guest_count INT,
    max_guest_count INT,
    price_range VARCHAR(10),                          -- ₱, ₱₱, ₱₱₱ style bucket for filtering
    verification_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (verification_status IN ('pending','verified','rejected','suspended')),
    verified_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,           -- platform admin kill-switch
    onboarded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_verification ON organizations(verification_status);

-- =========================================================================
-- PLATFORM ADMINS — distinct from org users, cross-tenant access
-- =========================================================================
CREATE TABLE IF NOT EXISTS platform_admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    permission_level VARCHAR(50) NOT NULL DEFAULT 'support'
        CHECK (permission_level IN ('super_admin','ops','support','finance')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    totp_secret VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- =========================================================================
-- SUPPLIER ACCOUNTS — suppliers become platform participants, not rows a caterer types in
-- =========================================================================
CREATE TABLE IF NOT EXISTS supplier_accounts (
    id SERIAL PRIMARY KEY,
    supplier_id INT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- A supplier can serve many organizations; an organization can use many suppliers.
-- This is the actual marketplace edge on the supply side.
CREATE TABLE IF NOT EXISTS organization_suppliers (
    id SERIAL PRIMARY KEY,
    organization_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    supplier_id INT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked')),
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE (organization_id, supplier_id)
);

-- =========================================================================
-- SUBSCRIPTIONS — SaaS billing for organizations (Business Model item #1)
-- =========================================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,          -- 'free','starter','pro','enterprise'
    name VARCHAR(100) NOT NULL,
    monthly_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    booking_commission_pct NUMERIC(5,2) NOT NULL DEFAULT 0,  -- Business Model item #2
    max_active_bookings INT,                    -- NULL = unlimited
    ai_features_included BOOLEAN NOT NULL DEFAULT FALSE,      -- Business Model item #4
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS organization_subscriptions (
    id SERIAL PRIMARY KEY,
    organization_id INT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id INT NOT NULL REFERENCES subscription_plans(id),
    status VARCHAR(20) NOT NULL DEFAULT 'trialing'
        CHECK (status IN ('trialing','active','past_due','canceled')),
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    canceled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

### 2.2 Retrofit `organization_id` onto every existing tenant-scoped table

This is the largest mechanical piece of Phase 1. Run one migration that:

```sql
-- Pattern, repeated for every business-scoped table:
-- customers, events, menus, menu_items, ingredients, suppliers, supplier_prices,
-- purchase_orders, event_menus, staff, staff_assignments, event_costs,
-- demand_forecasts, consumption_logs, risk_flags, leads, quotations, order_items,
-- contracts, invoices, payments, inventory_transactions, equipment_assets,
-- venues, vehicles, expenses, notifications_log, ... (all 78 minus the new global ones)

ALTER TABLE customers ADD COLUMN IF NOT EXISTS organization_id INT REFERENCES organizations(id);
UPDATE customers SET organization_id = 1 WHERE organization_id IS NULL;  -- backfill into "org #1"
ALTER TABLE customers ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(organization_id);
```

Do **not** hand-write this 78 times. Generate it:

```sql
-- Run once to produce the ALTER statements for every table that needs one,
-- then eyeball the output before executing (skip users/roles/organizations/etc.)
SELECT format(
  'ALTER TABLE %I ADD COLUMN IF NOT EXISTS organization_id INT REFERENCES organizations(id);',
  table_name
)
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
AND table_name NOT IN (
  'organizations','platform_admins','supplier_accounts','organization_suppliers',
  'subscription_plans','organization_subscriptions','roles','permissions',
  'role_permissions','users','subscriber_accounts','webauthn_credentials'
);
```

**Practical sequencing:** create one seed row `INSERT INTO organizations (id, slug, name, contact_email, verification_status) VALUES (1, 'your-current-business', 'Your Business Name', 'you@example.com', 'verified');` *before* running the backfill, so `organization_id = 1` always resolves. This is how your existing seeded data (55 customers, 110 events, etc.) survives the migration intact as the platform's first tenant — nothing is lost, it just becomes Org #1.

### 2.3 Update `users` and `staff` to belong to an organization

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id INT REFERENCES organizations(id);
UPDATE users SET organization_id = 1 WHERE organization_id IS NULL;
ALTER TABLE users ALTER COLUMN organization_id SET NOT NULL;
-- 'Operator' role becomes org-scoped; platform admins live in their own table (2.1), never in `users`
```

### 2.4 Update every `+server.js` under `/api/**`

Move today's global routes to `/api/org/[resource]` (or keep the path and just inject `WHERE organization_id = $1`) — either works, but pick one convention and apply it everywhere at once so nothing is accidentally left unscoped:

```js
// src/routes/api/customers/+server.js — BEFORE (implicitly single-tenant)
export async function GET() {
  const result = await query('SELECT * FROM customers ORDER BY name');
  return json({ success: true, customers: result.rows });
}

// AFTER — tenant-scoped, org_id sourced only from locals (never trust client input here)
export async function GET({ locals }) {
  if (!locals.tenantId) return json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const result = await query(
    'SELECT * FROM customers WHERE organization_id = $1 ORDER BY name',
    [locals.tenantId]
  );
  return json({ success: true, customers: result.rows });
}
```

Do this for every route in `src/routes/api/{customers,events,menus,ingredients,staff,suppliers,purchase-orders,settings}/+server.js` — that's the full list per your earlier route inventory. Treat it as a single sprint task with one PR per resource so each is reviewable and testable in isolation, and write one integration test per route asserting cross-tenant data never leaks (create data under org 1 and org 2, confirm org 1's session never sees org 2's rows).

### 2.5 `settings` becomes per-organization, not a hardcoded singleton row

Today `business_settings`-style config is a single row. Fold it into `organizations` directly (columns like `contact_email`, `service_areas`, plus a `settings JSONB` column for anything freeform like tax rate or receipt branding) instead of a separate `id SMALLINT CHECK (id=1)` table — that CHECK constraint is precisely the multi-tenant blocker your plan overview needs removed.

---

## Part 3 — Phase 2: Four-Portal Auth

You already have real building blocks (`hooks.server.js`, session/JWT logic, WebAuthn, TOTP, Google SSO, OTP). The work here is routing each persona to the right table and stamping a `type` + `organization_id` (or null) into the session, not rebuilding auth.

| Persona | Table | Login route | Session `type` | `tenantId` in `locals` |
|---|---|---|---|---|
| Platform Admin | `platform_admins` | `/admin/login` | `platform_admin` | `null` (cross-tenant) |
| Org staff (owner, sales, kitchen, etc.) | `users` (+ `roles`/`permissions`, already exist) | `/[orgSlug]/login` or `/api/auth/login` | `org_user` | `users.organization_id` |
| Customer | `subscriber_accounts` (already exists) | `/login` (marketplace) | `subscriber` | `null` — a customer can book with multiple orgs |
| Supplier | `supplier_accounts` (new, 2.1) | `/supplier/login` | `supplier` | `null` — a supplier serves multiple orgs |

Concretely:
1. Extend whatever session/JWT payload `src/routes/api/auth/login/+server.js` currently issues to include `type` and `organization_id`. Since `users.role` already exists, map `role IN ('Owner','Admin', ...)` → still `type: 'org_user'`; the distinction that matters for isolation is the table, not the role.
2. Add `src/routes/api/auth/supplier-login/+server.js`, modeled directly on the existing `portal-login`/`register-subscriber` pair — same OTP/password pattern, pointed at `supplier_accounts`.
3. Add `src/routes/api/auth/admin-login/+server.js` for `platform_admins` — this one should mandatory-enforce the existing TOTP flow (you already have `verify-totp`), since platform-admin compromise is the worst-case breach.
4. In `hooks.server.js`, resolve based on which cookie/token namespace is present (keep them namespaced — e.g. `cs_org_session`, `cs_admin_session`, `cs_customer_session`, `cs_supplier_session` — so a customer session can never accidentally get treated as an org session even by a bug).
5. Route guards: `(admin)` routes reject anything but `platform_admin`; `(org)/[orgSlug]` routes reject anything but `org_user` **and** additionally verify `locals.user.organization_id === params.orgSlug`'s resolved id (so an Org A staff member typing Org B's slug into the URL still gets rejected — this is the second most common tenant-isolation bug after trusting client-supplied IDs).

---

## Part 4 — Phase 3: Marketplace Surface (Customer-Facing)

This is the part that makes it feel like Grab/Foodpanda instead of an admin panel with a login screen.

### 4.1 Public discovery (`(marketplace)/+page.svelte`, `caterers/+page.svelte`)
- Search/filter by `service_areas`, `price_range`, `min_guest_count`/`max_guest_count`, cuisine/theme tags (add a `cuisine_tags TEXT[]` column to `organizations`).
- Each result card reads from `organizations` where `verification_status = 'verified' AND is_active = TRUE` only — this is also your platform's trust/safety lever (Section platform AI: fraud/fake-review detection eventually gates this flag).

### 4.2 Org storefront (`caterers/[slug]/+page.svelte`)
- Public menu/package browsing pulled from that org's `menus`/`menu_items` (already exist, just newly filtered by `organization_id`).
- Reviews (`reviews` table already exists in schema — surface it here).
- "Request Quote" CTA that creates a row in `leads` (already exists) with `organization_id` set to the storefront's org and `source = 'marketplace'`.

### 4.3 Two booking entry points, one data model

A real catering business will always take phone-in, walk-in, and referral bookings alongside app bookings — forcing every customer through self-service loses business on day one. So this is deliberately **not** an either/or: bookings can be created by the customer directly (marketplace self-service) *or* by org staff on the customer's behalf (phone/walk-in/referral), and both land in the exact same `events`/`order_items` row, lifecycle, and reporting. The org never has two booking systems to reconcile — two doors into the same room.

**Path A — Customer self-service:** customer browses a storefront (4.2), picks a package, books, pays deposit, no staff involved until confirmation.

**Path B — Org-entered booking:** staff takes a call or meets a walk-in and fills in the booking directly inside `(org)/[orgSlug]/bookings` — the same form your current `planner/+page.svelte` already does. No customer login required, ever, and this path must stay exactly as fast as it is today.

**Schema — `customers` is always the source of truth; `subscriber_accounts` is an optional overlay:**

- `customers` = "who is this person, to *this org*." Always exists for every booking regardless of channel. Owned entirely by the org.
- `subscriber_accounts` = "this person has a platform login." Optional — may or may not exist. One subscriber account can link to *multiple* orgs' `customers` rows (the same person books with three different caterers over time).

```sql
ALTER TABLE customers ADD COLUMN IF NOT EXISTS subscriber_account_id INT REFERENCES subscriber_accounts(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS booking_source VARCHAR(20) NOT NULL DEFAULT 'org_manual'
    CHECK (booking_source IN ('marketplace_self_service','org_manual','phone','walk_in','referral'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_by_user_id INT REFERENCES users(id); -- null if customer-initiated
```

| | Path A: Marketplace | Path B: Org-entered |
|---|---|---|
| Who creates the `events` row | Customer, via checkout flow | Staff, via internal form |
| Is a `customers` row created? | Yes — auto-created/matched for that org (email/phone match) | Yes — staff types it in, same as today |
| Is a `subscriber_accounts` row required? | Yes, they're logged in | No |
| `booking_source` | `marketplace_self_service` | `org_manual` / `phone` / `walk_in` / `referral` |

**Reconciliation — bridging the two paths over time:**
1. *Auto-match on signup:* when a `subscriber_accounts` row is created, check if any org's `customers.email`/`phone` already matches. If so, prompt to link (`customers.subscriber_account_id`) — covers a phone customer who later signs up on the marketplace.
2. *Staff-initiated invite:* after creating a manual booking, staff gets an optional "Send tracking link" action — creates (or reuses) a `subscriber_accounts` row and emails a magic link, with no self-signup required. This is the main UX bridge: low friction for the org, app-like visibility (status tracker, invoice, e-signature) for the customer even though they never touched the marketplace to book.

**The customer's own dashboard (`bookings/+page.svelte`):** a `subscriber_accounts` customer's bookings can legitimately span multiple `organization_id`s — this is the one place a customer-facing query intentionally does **not** filter by a single org, but instead by `subscriber_account_id` across orgs, joining through `customers.subscriber_account_id`.

**One open business-model decision worth making explicitly:** should the commission in Part 5.2 apply only to `marketplace_self_service` bookings the platform actually originated, or to every booking regardless of `booking_source` (including ones the org would have gotten with or without the platform)? Not a technical question, but it will shape how hard the product pushes orgs toward Path A versus leaving Path B just as frictionless.

### 4.4 Supplier↔Org commerce (this is the actual "suppliers" marketplace edge)
- `organization_suppliers` (2.1) is the connection. Build:
  - Supplier-side: `supplier/products/+page.svelte` — supplier manages their own catalog (extend `supplier_prices` or add a proper `supplier_products` table if you want richer product data than "ingredient + price").
  - Org-side: existing `suppliers`/`purchase-orders` pages gain a "Browse Marketplace Suppliers" tab that lets an org connect to any verified supplier account (inserts into `organization_suppliers`), instead of only the suppliers that org typed in manually.
  - Purchase orders (`purchase_order_headers`/`purchase_order_lines`, already in schema) become the transaction that flows *between* two tenants (org buyer, supplier seller) rather than a row inside one tenant's private data — this is the piece that most changes in spirit versus everything else in this plan, so budget real design time here, not just a schema tweak.

---

## Part 5 — Phase 4: Platform Admin & Billing

### 5.1 Admin portal (`(admin)/admin/**`)
- `organizations/+page.svelte`: list all orgs, filter by `verification_status`, approve/reject/suspend (`is_active` toggle).
- `organizations/[id]/+page.svelte`: drill into one org's activity — bookings volume, subscription status, support tickets (table already exists).
- `subscriptions/+page.svelte`: manage `subscription_plans`, view `organization_subscriptions`, handle plan changes.
- Platform-wide analytics: total GMV (sum of booking values across all orgs), active orgs, churn — this is genuinely new reporting, not a repurpose of the existing per-org "Profit Analyzer" (which Part 2 of `added-plan.md` already flagged as fake and due for a real rebuild regardless).

### 5.2 Billing mechanics
- Subscriptions (`organization_subscriptions`): recurring monthly charge per org, via whatever payment gateway you pick for Section L of your existing gap analysis (PayMongo fits your ₱ market).
- Commission (`subscription_plans.booking_commission_pct`): computed at the point an `invoice`/`payment` row is created for a booking — add a `platform_fee_amount` column to `payments` or `invoices`, computed as `amount * (plan.booking_commission_pct / 100)`, and a nightly job that rolls these into a platform revenue ledger. Whether this applies to every booking or only ones with `events.booking_source = 'marketplace_self_service'` (see 4.3) is the open business-model call — decide it before this job goes live, since it's awkward to change retroactively once orgs are relying on a given number.
- Do **not** build a custom payment processor. Use PayMongo/Stripe Connect-style flows so money legally lands with the org and the platform's cut is a separate transfer — this is a compliance issue (money transmission licensing), not just an engineering one, and worth a deliberate "we are not becoming a payment processor" decision early.

---

## Part 6 — Sequencing & Effort

This assumes you keep the existing single-business functionality working throughout — nothing here requires a rewrite, it's additive plus one mechanical retrofit (Part 2.2).

| Phase | Scope | Depends on | Rough effort |
|---|---|---|---|
| **1. Tenant foundation** | `organizations` table, `organization_id` retrofit on all 78 tables, scope every `/api/**` route, re-enable SSR for marketplace group | Nothing — do first | 1–2 weeks |
| **2. Four-portal auth** | `platform_admins`, `supplier_accounts` tables + login routes, `hooks.server.js` tenant resolution, route guards | Phase 1 | 1 week |
| **3. Marketplace surface** | Public discovery, org storefronts, cross-org customer bookings, supplier↔org connections | Phases 1–2 | 2–3 weeks |
| **4. Platform admin & billing** | Admin portal, subscription plans, commission ledger, payment gateway integration | Phases 1–3 | 2 weeks |

Everything in your existing `added-plan.md` (real inventory ledger, real invoicing, real AI reconnection, etc.) still applies **inside** each org's `(org)/[orgSlug]` workspace — that roadmap doesn't get replaced by this one, it gets tenant-scoped by Phase 1 and then continues on the schedule you already had. The two documents are complementary: `added-plan.md` is "make one catering business's operations real," this document is "make many catering businesses coexist safely on one platform."

## Part 7 — The Single Highest-Risk Item

If you do only one thing carefully from this whole document, make it **Part 2.4/1.2**: never let `organization_id` come from anywhere except `locals.tenantId`, which itself only comes from the server-verified session. The entire multi-tenant promise — that Org A can never see Org B's customers, bookings, or financials — depends on that one rule holding in every single `+server.js` file, with no exceptions "just for now." A single route that reads `?org_id=` from the query string and trusts it is a full data breach across every tenant on the platform. Worth writing the cross-tenant-isolation integration test suite (mentioned in 2.4) before marketing this to a second real business.

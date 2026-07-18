# CaterSync-AI — Unified Login / Sign-Up Flow Plan

Scope: **planning only**. No code changes in this doc — this is the blueprint the fixes will follow.

---

## 1. What's actually there right now (audit)

The app currently has **three separate, disconnected entry points**, each with its own page and its own auth logic:

| Route | Entity | Auth method | File |
|---|---|---|---|
| `/login` | Customer only | Email OTP + Google | `src/routes/login/+page.svelte` |
| `/supplier/login` | Supplier only | Password (presumably) | `src/routes/supplier/login/+page.svelte` |
| Operator console gate | Operator only | Password / PIN / Biometric tabs shown all at once | `src/lib/components/LandingPage.svelte` |
| `/admin/login` | Platform admin | Password + TOTP | `src/routes/admin/login/+page.svelte` |

Each entity lives in its **own DB table** with no shared identity:

- `users` → Operator (org staff)
- `subscriber_accounts` → Customer
- `supplier_accounts` → Supplier
- `platform_admins` → Admin (manual/invite-only, not part of self-service sign-up)

**The core bug you're describing** is right here: every registration endpoint only checks **its own table** for a duplicate:

- `register-operator` → `SELECT id FROM users WHERE email = $1`
- `register-subscriber` → `SELECT id FROM customers WHERE email = $1`
- `register-supplier` → `SELECT id FROM supplier_accounts WHERE email = $1`

None of them check the *other two* tables. So today, nothing stops `medy@gmail.com` from becoming a Customer **and** an Operator **and** a Supplier — three fully separate accounts under one email, which is exactly what "1 account = 1 entity" is supposed to prevent.

`complete-profile/+server.js` already has a nice unified shape (`accountType: 'customer' | 'operator' | 'supplier'`), so the backend pattern for "one endpoint, branch by type" already exists — it's just not applied to the entry/registration step yet.

---

## 2. Target behavior (in plain terms)

1. **One landing page.** Not three. A single card with:
   - **Main Login** section on top.
   - **"Don't have an account? Sign Up"** link/section directly below it.
2. **Login is identity-first, not entity-first.** The user doesn't pick "I'm a customer" to log in — they just enter their email/phone + credential, and the system figures out *which one entity* that identity belongs to and logs them into that portal.
3. **Enforce 1 account → 1 entity, at the database level, not just at the UI.** An email/phone that's already a Customer can never complete registration as an Operator or Supplier (and vice versa) — the check has to run across all three tables, not just one.
4. **Sign Up asks "Who are you?" first** — a 3-way selector: **Customer / Operator / Supplier**. Whichever is picked drives which fields and which table the account lands in.
5. **Name + Phone are always required**, for all three types, regardless of sign-up method. This includes the Google flow — Google only gives you an authenticated email (+ a name that may be missing/unreliable). Phone is never provided by Google, so **Google sign-up must always drop the user into a "finish your profile" step** before the account is usable.

---

## 3. Screen-by-screen plan

### 3.1 Screen A — Unified Landing (`/login` becomes the single entry point)

```
┌───────────────────────────────────┐
│           CaterSync                │
│      ─── Welcome back ───          │
│                                     │
│  Email or Phone                    │
│  [__________________________]      │
│                                     │
│  ⤷ Continue with Google            │
│                                     │
│         [   Continue   ]           │
│                                     │
│  ───────────────────────────       │
│  Don't have an account?            │
│           Sign Up →                │
└───────────────────────────────────┘
```

- Identifier-first: user types email/phone, hits **Continue**.
- No entity tabs shown up front — the account type is resolved server-side (Step 3.2 below), not chosen by the user at login. A person shouldn't have to remember "was I a Supplier or Operator" — the system already knows.
- **Sign Up** is a secondary, clearly de-emphasized link/panel below the main card — not an equal-weight tab. This matches the "main login, sign-up below it" ask directly.
- Admin login is **not** exposed here at all — it stays a hidden/direct-URL-only route (`/admin/login`), consistent with `login-entity.md`'s "manual-only, never self-registered" rule for admins. It's not part of the public 3-way sign-up.

### 3.2 Identity Resolution Endpoint (new, backend)

A single new lookup step — call it `POST /api/auth/resolve-identity` — runs **before** any password/OTP form is shown:

1. Takes the raw email/phone.
2. Checks, in order: `subscriber_accounts` → `supplier_accounts` → `users` (skip `platform_admins`, not self-serve).
3. Returns which single entity type owns that identity, plus what auth method that entity uses (Customer = OTP/Google, Supplier = password, Operator = password/PIN/biometric).
4. If the identity exists in **more than one** table (shouldn't happen once §4 is enforced, but must be handled defensively for existing/legacy dirty data) → flag it as a **conflict** and route to a manual-resolution/support message instead of silently picking one.
5. If it exists in **zero** tables → tell the user no account was found and point them at Sign Up (don't auto-create anything from a login attempt).

The login screen then swaps in **only the relevant next step** (OTP box, password box, etc.) — same "progressive disclosure" pattern already scoped in `app-registration.md` Part 2, just now also deciding *which entity*, not only *which method*.

### 3.3 Screen B — Sign Up

```
┌───────────────────────────────────┐
│           Create Account           │
│                                     │
│   I am a:                          │
│   ( Customer )( Operator )( Supplier )
│                                     │
│  Full Name                         │
│  [__________________________]      │
│  Phone Number                      │
│  [__________________________]      │
│  Email                             │
│  [__________________________]      │
│                                     │
│  [ ...entity-specific fields... ]  │
│                                     │
│  ⤷ Continue with Google            │
│         [   Create Account  ]      │
│                                     │
│  Already have an account? Log In ← │
└───────────────────────────────────┘
```

- **Step 1:** 3-way selector — Customer / Operator / Supplier. This choice determines the destination table and the rest of the form. (Matches the existing `accountType` values already used by `complete-profile`.)
- **Step 2 (shared, always required):** Full Name + Phone Number — identical across all three types, exactly as requested.
- **Step 3 (entity-specific, shown conditionally):**
  - **Customer:** email (or phone) only beyond the shared fields — kept lightweight since this is the highest-volume, most conversion-sensitive signup.
  - **Operator:** email + (optionally) position/role, tied to an `organization_id`.
  - **Supplier:** email + Company Name + Category, tied to a `supplier` record.
- **Step 4:** Either continue with password/OTP flow, or **Continue with Google**.

### 3.4 Google Sign-Up — "fill the remaining fields" rule

Today `register-operator`'s Google-adjacent path *already* requires name+phone before creating a row — that pattern is correct and needs to be the **standard**, applied uniformly to all three entity types (currently Customer's Google path is more lenient and can skip straight to OTP without ever collecting a phone number — that's the gap to close).

Planned flow for **all three** entity types when "Continue with Google" is used on Sign Up:

1. Google returns a verified email (+ maybe a name).
2. Server checks that email against **all three tables** (§4) — if it already belongs to a different entity type, reject with a clear "this email is already registered as a Customer/Operator/Supplier" message, don't silently log them in as the wrong type.
3. If clear: create a **pending** row in the correct table (status `pending`), tagged with whichever entity type was selected in Step 1 of Sign Up — pre-filling name from Google *only* as a suggestion, never as a substitute for the required field.
4. Immediately route to a **"Finish your profile"** screen requesting: Phone Number (always, since Google never supplies it) + Name (pre-filled, editable) + any entity-specific fields (Company Name/Category for Supplier, Position for Operator).
5. Only after that submits does status flip to `active` and the session get issued — same shape `complete-profile` already implements, just guaranteed to run for every Google path, not only some.

---

## 4. Enforcing "1 account = 1 entity"

This has to be enforced in two places, not one:

### 4.1 At write time (the real fix)
Every path that can create an identity — `register-subscriber`, `register-operator`, `register-supplier`, and all three Google sign-up variants — must run **one shared cross-table check** before insert:

```
identity (email AND/OR phone) must not already exist in:
  subscriber_accounts  OR  supplier_accounts  OR  users
```

Concretely: extract this into one reusable server helper (e.g. `checkIdentityAvailable(email, phone)`) that all six registration entry points call first. Right now each endpoint only queries its own table — this helper is the missing piece that actually creates the "1 account = 1 entity" guarantee, not just describes it.

If the identity is already claimed elsewhere → reject with: *"This email/phone is already registered as a [Customer/Operator/Supplier]. Please log in instead."* — never silently merge or silently create a second entity.

### 4.2 At session time (the safety net)
Even with §4.1 in place, add a session-level guard: while a session cookie for one entity type is active, block any attempt to hit a *different* entity's login/register endpoint in the same browser session without an explicit logout first. This catches edge cases like stale data from before the fix, or someone with a genuinely different email trying to open a second entity type in the same tab out of confusion — surfacing "You're currently logged in as a Customer — log out first to access the Supplier/Operator portal" rather than silently switching context mid-session.

---

## 5. Routing after login/signup

Once the entity is resolved (login) or created (signup), redirect by type — this part already mostly exists and just needs to be the single funnel point:

| Entity | Destination |
|---|---|
| Customer | `/portal` |
| Operator | `/` (main console) |
| Supplier | Supplier dashboard (currently under `/supplier/*`) |
| Admin | `/admin` (unchanged, separate gate) |

---

## 6. Files this plan touches (for the follow-up fix pass — not done in this doc)

**New:**
- `src/routes/api/auth/resolve-identity/+server.js` — cross-table identity lookup for login
- Shared helper: `src/lib/server/auth/identity.js` — `checkIdentityAvailable(email, phone)` used by all registration endpoints

**Consolidated:**
- `src/routes/login/+page.svelte` → becomes the single `/login` (Login + Sign Up in one page, replacing today's customer-only version)
- `src/lib/components/LandingPage.svelte` (operator gate) → retired as a separate entry point, logic folded into the unified page
- `src/routes/supplier/login/+page.svelte` → retired as a separate entry point, folded into the unified page
- `src/routes/admin/login/+page.svelte` → **kept as-is**, stays outside the unified/public flow

**Updated (add the §4.1 cross-check + enforce name/phone on Google path):**
- `register-subscriber/+server.js`
- `register-operator/+server.js`
- `register-supplier/+server.js`
- `google-login/+server.js`
- `google-operator-login/+server.js`
- `complete-profile/+server.js` (already type-aware — mainly needs the cross-table check added before it flips `status` to `active`)

---

## 7. Edge cases to design for

- **Someone types a phone number that's a Customer's phone but the email of a different Supplier** (shared device/family scenario) — resolve-identity should check email and phone independently and flag a mismatch rather than guessing.
- **Legacy/dirty data**: since the cross-table check doesn't exist yet, it's possible some identities already exist in two tables today. Plan a one-time audit query (`SELECT email FROM subscriber_accounts INTERSECT SELECT email FROM users INTERSECT ...`) to find and manually resolve collisions *before* turning on the hard enforcement, so real users don't get locked out on day one.
- **Google account with no name at all** — treat exactly like a missing name typed manually: block until filled in on the "finish your profile" screen.
- **User abandons sign-up mid-way** (picked entity type, filled name/phone, closed tab before finishing) — the `pending` status row already supports resuming; on next Sign Up attempt with the same email, detect the `pending` row and resume at "finish your profile" instead of creating a duplicate.

---

## 8. Suggested build order

| Phase | Work |
|---|---|
| 0 | Legacy-data audit for existing cross-table collisions; resolve manually |
| 1 | Build `checkIdentityAvailable()` helper; wire into all 3 register endpoints + `complete-profile` |
| 2 | Build `resolve-identity` endpoint |
| 3 | Merge the 3 entry-point pages into one `/login` (Login card + Sign Up link/panel below) |
| 4 | Build the Sign Up screen: 3-way selector → shared fields (name/phone) → entity-specific fields |
| 5 | Fix the two Google paths (`google-login`, `google-operator-login`) to always force the "finish your profile" step, and add Google to the Supplier path if it doesn't have it yet |
| 6 | Session-level guard (§4.2) preventing entity-switch mid-session without logout |
| 7 | Retire `LandingPage.svelte` and `/supplier/login` as separate routes once the unified page is verified |
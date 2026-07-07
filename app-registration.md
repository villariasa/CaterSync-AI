# CaterSync-AI — Subscriber Registration, Login/Landing Redesign & Device-Only PIN/Biometric Plan

> Grounded in the actual repo: `src/routes/api/auth/*`, `src/routes/+layout.svelte`, `src/lib/components/LandingPage.svelte`, `src/lib/components/BiometricScanner.svelte`, `src/routes/portal/+page.svelte`, and `db/schema.sql`.

## 0. Findings from the current codebase (read this first)

- **The `users` table doesn't exist.** `login/+server.js` and `register/+server.js` both run `SELECT * FROM users`, but `schema.sql` never creates a `users` table (only `staff`, `customers`, `roles`, `permissions`, `audit_log` — and `audit_log` already has a `user_id` column with nowhere to point). In practice the operator login is almost certainly always falling back to the `usingMockData` path (`admin` / `admin`), since the real DB query would fail.
- **"Subscriber" isn't an existing term in the codebase.** The closest concept is the **Portal** (`/portal`, `/api/auth/portal-login`), where a client logs in by typing a name/phone/email string — no account, no password, just a 6-hour cookie if the string matches a `customers` row. This plan treats **"subscribers" as these clients/customers**, distinct from **Operators/Staff** who use the main console. Flag it if you meant something else (e.g. paid tiers).
- **PIN is already device-local-ish** — stored in `localStorage` (`catersync_registered_pin`), not sent to a DB — but it's **plaintext** and defaults to `'1234'` for every account.
- **Biometrics is currently broken as an auth check.** `BiometricScanner.svelte` calls `navigator.credentials.create()` (enrollment) on *every* login attempt instead of enrolling once and calling `.get()` to verify. Right now it only proves "this browser supports a platform authenticator," not "this is the same person who logged in before."

---

## Part 1 — Subscriber (Client) Registration & Onboarding

**Goal:** replace the "type your name and hope it matches" Portal check with a real self-service account, without disrupting how staff already create `customers` / `events` when a booking comes in.

### New table
```sql
CREATE TABLE subscriber_accounts (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id) ON DELETE SET NULL, -- linked once claimed
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50) UNIQUE,
    password_hash TEXT,                -- nullable: OTP-only accounts never need one
    email_verified_at TIMESTAMPTZ,
    phone_verified_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','active','disabled')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_login_at TIMESTAMPTZ
);
```

### Flow
1. **Sign-up entry point** — a "Create your account" link on `/portal`, plus: whenever staff create a new `customers` row on an inquiry, auto-generate an invite ("Set up portal access") sent through the existing `send-email` endpoint.
2. **Identity capture** — email or phone only (matches the existing `portal-login` lookup fields).
3. **OTP verification** — 6-digit code, reusing the `nodemailer` / Ethereal setup already in `send-email/+server.js`. Phone/SMS can plug in later — email-only OTP is enough for MVP.
4. **Account claim** — after verification, search `customers` by matching `email`/`contact`; if found, link `customer_id`; if not found, create a bare `customers` row so staff sees the person on next contact.
5. **Set up device security** — this is where PIN/biometric enrollment happens (see Part 3), never a mandatory plain password.
6. **Session** — issue a `subscriber_session` cookie, separate from `portal_customer_id` and `session_user`, so Operator / Staff / Subscriber sessions never collide.

### Edge cases to design for
- One contact shared by a family — allow multiple emails per `customer_id`.
- A customer who books again years later — needs a re-claim flow.
- Guests who don't want an account — keep the current lightweight "quick lookup, no account" path available for people who just want to check an invoice once; don't force registration.

---

## Part 2 — Landing / Login Page Redesign

The current `LandingPage.svelte` shows **all four auth methods as tabs at once** (Password / PIN / Biometric / Sign Up). That was common a few years ago; the 2026 standard (Google, GitHub, banking apps) is **identifier-first, progressive disclosure**:

1. User types just their **username/email** and hits Continue.
2. The screen then shows *only* the methods actually available for that account (if a passkey is enrolled, Face/Touch ID is front and center; PIN and password become secondary "use another method" links, not equal-weight tabs).
3. Registration lives on its own screen, not a tab jammed into the login card.

### Applied to your two entry points
- **Operator Console** (`LandingPage.svelte`) — keep the kitchen-ticket / "ACCESS GATE" branding, it's intentional and on-theme for staff. Collapse it to identifier → contextual method, and only show the Biometric option if the account has actually enrolled a passkey (not just "browser supports it," which is the current check).
- **Subscriber Portal** (`portal/+page.svelte`) — needs a **friendlier tone**. Customers booking a birthday party shouldn't feel like they're clearing airport security. Keep the visual language (paper/ticket textures, existing palette), soften the copy — "Welcome back" instead of stamps and system-status language like "CLIENT CHECK-IN."
- **Layout** — split-screen on desktop (branding/illustration left, form right), single column on mobile. Standard for both surfaces now.

### Small bugs to fix while in there
- `handlePinInput` has zero rate-limiting.
- The register form pre-fills `regPIN` with `'1234'` — shouldn't ship a default PIN.

---

## Part 3 — Device-Only PIN & Biometric Verification

"PIN stored on the device, not the DB" can mean two different things depending on what's being protected — split into the two mechanisms below.

### Biometric (WebAuthn / passkeys) — fixing the existing bug
- **Enroll once**, after a successful primary login: call `navigator.credentials.create()` with `authenticatorSelection: { residentKey: 'required', userVerification: 'required' }`, tied to the real account ID (not the random throwaway `userId` generated today).
- Store **only the public key + credential ID** server-side. This is the one deliberate exception: a WebAuthn public key is **not a secret** — it's cryptographically useless without the private key, which never leaves the device's secure enclave. Storing it isn't "storing the fingerprint," it's storing a lock that only that device's key can open.
- **Every subsequent login** calls `.get()`, not `.create()` — this is the verification step that's currently missing entirely.

```sql
CREATE TABLE webauthn_credentials (
    id SERIAL PRIMARY KEY,
    account_id INT NOT NULL,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('operator','subscriber')),
    credential_id TEXT UNIQUE NOT NULL,
    public_key TEXT NOT NULL,
    sign_count BIGINT NOT NULL DEFAULT 0,
    device_label VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

Worth switching to `@simplewebauthn/server` + `@simplewebauthn/browser` rather than hand-rolling the challenge/response — the current code generates its own random challenge client-side, which isn't verifiable server-side at all.

### PIN — genuinely device-only
The PIN must **never reach the server**, not even hashed — otherwise it isn't really device-only. This is the standard "quick unlock" pattern banking apps use:

1. After a real login (password/OTP), the server issues a normal session/refresh token, same as today.
2. The device asks the user to **choose a PIN right there** — invented fresh, per device, never fetched from anywhere.
3. The PIN is run through PBKDF2/Argon2 (via the browser's Web Crypto API) to derive a local encryption key.
4. That key encrypts the session/refresh token; the encrypted blob is saved in **IndexedDB** (more appropriate than `localStorage` for this — structured storage, not casually visible in dev tools the way `localStorage` is).
5. On next app open: user enters PIN → device re-derives the key → tries to decrypt the blob → success returns the token and re-validates with the server. A wrong PIN just fails to decrypt — no network call, nothing for the server to see or rate-limit.
6. Add a **local** attempt counter — wipe the blob after ~5 wrong tries, forcing full re-login. This is what protects against someone with the physical device guessing PINs, since there's no server involved otherwise.
7. Forgotten PIN / lost device needs **no server-side "reset PIN" flow** at all, because the server never had it — the user just logs in fresh and sets a new PIN on the new device.

This replaces the current single shared `registeredPIN` (one plaintext PIN per mock account) with a real per-device, per-account secret that only ever exists on that device.

---

## Suggested Build Order

| Phase | Work |
|---|---|
| 0 | Add `subscriber_accounts`, `webauthn_credentials` tables; add the missing operator accounts table (needed regardless — `roles`/`audit_log` already assume one exists) |
| 1 | Subscriber registration + OTP claim flow on `/portal` |
| 2 | Identifier-first login redesign — Operator console first, then Portal |
| 3 | WebAuthn enroll/verify fix (enroll-once + `.get()` verify, instead of `.create()` every time) |
| 4 | Device-local encrypted PIN vault, replacing the `localStorage` PIN |
| 5 | Rate limiting, recovery flows, edge-case testing |
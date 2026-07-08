Here's the consolidated login design per entity, combining the auth method and session persistence into one view:

## 1. Platform Admin (developer / ops)
- **Login method:** Email/username + password
- **2FA:** TOTP — mandatory, no exceptions
- **Registration:** Manual only — created by an existing super_admin or directly in the DB, never self-registered
- **Session:** Short-lived (e.g. 7 days), no silent long-term persistence — highest trust, highest blast radius, so it should ask again more often

## 2. Organization (Owner, Kitchen, Sales, Driver, etc.)
- **Login method:** Email + password
- **2FA:** TOTP mandatory for Owner/Admin roles, optional for lower-risk roles (Driver, etc.)
- **Registration:** Invite-only — Owner is created on org approval, everyone else invited by the Owner/Admin
- **Session:** Medium (e.g. 7–14 days refresh window), with WebAuthn/passkey as a fast unlock option — good fit for shared kitchen tablets
- **Extra:** "log out everywhere" available if a password is compromised

## 3. Customer (marketplace)
- **Login method:** Phone or email OTP (primary), Google SSO (fast path), password optional
- **2FA:** None — wrong trade-off for a marketplace visitor
- **Registration:** Open, self-service
- **Session:** Long-lived refresh token in an httpOnly cookie (30–90 days, sliding) — this is the "already logged in like Facebook/TikTok/Foodpanda" behavior. Silent refresh on reopen; full OTP/password only asked again if the refresh token expires, they explicitly log out, or a password change forces revocation. Optional biometric (Face ID/fingerprint) quick-unlock on top, once WebAuthn is registered — gates the already-valid session locally, doesn't re-auth with the server
- **Devices screen:** list of active sessions with per-device revoke, like Facebook's "Where you're logged in"

## 4. Supplier
- **Login method:** Email + password
- **2FA:** Optional — worth prompting once they're actively transacting purchase orders with an org
- **Registration:** Open self-registration, but gated by `email_verified_at` before any real activity
- **Session:** Medium (e.g. 7–14 days), similar tier to Org staff

## The pattern underneath all four
**Trust and blast-radius go up → login friction and session tightness go up.** Admin and Org-Owner can see the most, so they re-authenticate the most. Customers convert the moment friction appears, so they get OTP-only login and near-permanent sessions. All four reuse the same auth primitives you've already built (`login`, `verify-otp`, `verify-totp`, `webauthn/register`, `webauthn/login`, `google-login`) — nothing here is new tech, just applied differently per persona.

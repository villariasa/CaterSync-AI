/**
 * src/lib/server/auth/tokens.js
 * 
 * Opaque token generation and hashing utilities.
 * Tokens are random bytes — no JWTs. They are validated by 
 * looking up their SHA-256 hash in the sessions table.
 */

import crypto from 'crypto';

const ACCESS_TOKEN_BYTES = 32;   // 256-bit access token
const REFRESH_TOKEN_BYTES = 48;  // 384-bit refresh token

/**
 * Generate a cryptographically random opaque access token.
 * @returns {string} Hex-encoded access token
 */
export function generateAccessToken() {
  return crypto.randomBytes(ACCESS_TOKEN_BYTES).toString('hex');
}

/**
 * Generate a cryptographically random opaque refresh token.
 * @returns {string} Hex-encoded refresh token
 */
export function generateRefreshToken() {
  return crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
}

/**
 * Hash a token for storage in the database.
 * We never store raw tokens — only their SHA-256 hashes.
 * @param {string} token 
 * @returns {string} SHA-256 hex digest
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a secure OTP code and its hash.
 * @returns {{ code: string, hash: string }}
 */
export function generateOtp() {
  const code = String(100000 + Math.floor(Math.random() * 900000));
  const hash = crypto.createHash('sha256').update(code).digest('hex');
  return { code, hash };
}

/**
 * Verify an OTP code against a stored hash.
 * @param {string} inputCode - Code entered by user
 * @param {string} storedHash - SHA-256 hash stored in DB
 * @returns {boolean}
 */
export function verifyOtpHash(inputCode, storedHash) {
  const inputHash = crypto.createHash('sha256').update(inputCode.trim()).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(inputHash, 'hex'), Buffer.from(storedHash, 'hex'));
}

/**
 * Generate a secure magic link token and its hash.
 * @returns {{ token: string, hash: string }}
 */
export function generateMagicLinkToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

/**
 * Per-role refresh cookie lifetime — mirrors session.js TTLs exactly.
 * The cookie must outlive the session or the browser will discard it first.
 */
const COOKIE_REFRESH_DAYS_BY_ROLE = {
  subscriber:     90,
  supplier:       60,
  org_user:       30,
  platform_admin: 14
};

/**
 * Set access + refresh token cookies on the response.
 * @param {import('@sveltejs/kit').Cookies} cookies
 * @param {string} accessToken
 * @param {string} refreshToken
 * @param {string|boolean} [roleOrTrusted] - user role string (preferred) or legacy boolean isTrusted
 */
export function setAuthCookies(cookies, accessToken, refreshToken, roleOrTrusted = false) {
  // Clear any existing legacy cookies to prevent cross-portal/cross-role conflicts
  const cookieOptions = { path: '/' };
  cookies.delete('cs_org_session', cookieOptions);
  cookies.delete('cs_admin_session', cookieOptions);
  cookies.delete('cs_customer_session', cookieOptions);
  cookies.delete('cs_supplier_session', cookieOptions);
  cookies.delete('session_user', cookieOptions);
  cookies.delete('portal_customer_id', cookieOptions);
  cookies.delete('operator_session', cookieOptions);

  // Support both new role-string and legacy boolean isTrusted calls
  let refreshDays;
  if (typeof roleOrTrusted === 'string') {
    refreshDays = COOKIE_REFRESH_DAYS_BY_ROLE[roleOrTrusted] ?? 60;
  } else {
    // Legacy: isTrusted=true → 90 days, false → 60 days
    refreshDays = roleOrTrusted ? 90 : 60;
  }

  cookies.set('cs_access_token', accessToken, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 15 // 15 minutes
  });

  cookies.set('cs_refresh_token', refreshToken, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * refreshDays
  });
}


/**
 * Clear all auth cookies (used on logout).
 * @param {import('@sveltejs/kit').Cookies} cookies
 */
export function clearAuthCookies(cookies) {
  const cookieOptions = { path: '/' };
  // New unified cookies
  cookies.delete('cs_access_token', cookieOptions);
  cookies.delete('cs_refresh_token', cookieOptions);
  // Legacy cookies — clear all of them on logout
  cookies.delete('cs_org_session', cookieOptions);
  cookies.delete('cs_admin_session', cookieOptions);
  cookies.delete('cs_customer_session', cookieOptions);
  cookies.delete('cs_supplier_session', cookieOptions);
  cookies.delete('session_user', cookieOptions);
  cookies.delete('portal_customer_id', cookieOptions);
  cookies.delete('operator_session', cookieOptions);
}

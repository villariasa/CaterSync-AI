/**
 * src/lib/server/auth/rate-limit.js
 * 
 * Rate limiting for authentication endpoints.
 * Uses the auth_rate_limits table (DB-backed) for persistence across restarts.
 * Falls back to in-memory map if DB is unavailable.
 */

import { pool } from '$lib/server/db.js';

// In-memory fallback (used if DB is offline)
const memoryStore = new Map();

/**
 * Rate limit configuration per endpoint key type.
 * key format: "type:identifier" — e.g. "otp_send:user@example.com"
 */
const LIMITS = {
  otp_send:     { max: 5,  windowMs: 10 * 60 * 1000, blockMs: 30 * 60 * 1000 },  // 5 per 10 min → block 30 min
  otp_verify:   { max: 5,  windowMs: 10 * 60 * 1000, blockMs: 30 * 60 * 1000 },  // 5 tries per 10 min
  login:        { max: 10, windowMs: 15 * 60 * 1000, blockMs: 15 * 60 * 1000 },  // 10 per 15 min
  google:       { max: 20, windowMs:  5 * 60 * 1000, blockMs: 10 * 60 * 1000 },  // 20 per 5 min
  global_ip:    { max: 100, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 }, // 100 per hour (hard)
};

/**
 * Check and increment rate limit for a given key.
 * @param {string} type - one of the LIMITS keys
 * @param {string} identifier - IP or email
 * @returns {Promise<{ allowed: boolean, remaining: number, retryAfterMs: number }>}
 */
export async function checkRateLimit(type, identifier) {
  const config = LIMITS[type] || LIMITS.login;
  const key = `${type}:${identifier}`;
  const now = Date.now();

  // --- Try DB-backed rate limiting ---
  try {
    const res = await pool.query(
      'SELECT attempts, blocked_until, last_attempt_at FROM auth_rate_limits WHERE key = $1 LIMIT 1',
      [key]
    );

    if (res.rows.length > 0) {
      const row = res.rows[0];
      const blockedUntil = row.blocked_until ? new Date(row.blocked_until).getTime() : null;
      const lastAttempt = new Date(row.last_attempt_at).getTime();
      const windowAge = now - lastAttempt;

      // If currently blocked
      if (blockedUntil && now < blockedUntil) {
        return { allowed: false, remaining: 0, retryAfterMs: blockedUntil - now };
      }

      // If window has expired, reset
      if (windowAge > config.windowMs) {
        await pool.query(
          `UPDATE auth_rate_limits SET attempts = 1, blocked_until = NULL, last_attempt_at = NOW() WHERE key = $1`,
          [key]
        );
        return { allowed: true, remaining: config.max - 1, retryAfterMs: 0 };
      }

      // Increment attempt
      const newAttempts = row.attempts + 1;
      let newBlockedUntil = null;

      if (newAttempts >= config.max) {
        newBlockedUntil = new Date(now + config.blockMs).toISOString();
      }

      await pool.query(
        `UPDATE auth_rate_limits SET attempts = $1, blocked_until = $2, last_attempt_at = NOW() WHERE key = $3`,
        [newAttempts, newBlockedUntil, key]
      );

      if (newBlockedUntil) {
        return { allowed: false, remaining: 0, retryAfterMs: config.blockMs };
      }

      return { allowed: true, remaining: config.max - newAttempts, retryAfterMs: 0 };
    }

    // First attempt — insert
    await pool.query(
      `INSERT INTO auth_rate_limits (key, attempts, last_attempt_at) VALUES ($1, 1, NOW())
       ON CONFLICT (key) DO UPDATE SET attempts = auth_rate_limits.attempts + 1, last_attempt_at = NOW()`,
      [key]
    );

    return { allowed: true, remaining: config.max - 1, retryAfterMs: 0 };
  } catch (dbErr) {
    // DB unavailable — fall back to in-memory
    console.warn('[rate-limit] DB unavailable, using in-memory fallback:', dbErr.message);
    return checkRateLimitMemory(key, config, now);
  }
}

/**
 * Reset rate limit for a key (e.g., on successful auth).
 * @param {string} type
 * @param {string} identifier
 */
export async function resetRateLimit(type, identifier) {
  const key = `${type}:${identifier}`;
  try {
    await pool.query('DELETE FROM auth_rate_limits WHERE key = $1', [key]);
  } catch {
    memoryStore.delete(key);
  }
}

// --- In-memory fallback ---
function checkRateLimitMemory(key, config, now) {
  const entry = memoryStore.get(key);
  if (!entry) {
    memoryStore.set(key, { attempts: 1, windowStart: now, blockedUntil: null });
    return { allowed: true, remaining: config.max - 1, retryAfterMs: 0 };
  }

  if (entry.blockedUntil && now < entry.blockedUntil) {
    return { allowed: false, remaining: 0, retryAfterMs: entry.blockedUntil - now };
  }

  if (now - entry.windowStart > config.windowMs) {
    memoryStore.set(key, { attempts: 1, windowStart: now, blockedUntil: null });
    return { allowed: true, remaining: config.max - 1, retryAfterMs: 0 };
  }

  entry.attempts++;
  if (entry.attempts >= config.max) {
    entry.blockedUntil = now + config.blockMs;
    return { allowed: false, remaining: 0, retryAfterMs: config.blockMs };
  }

  return { allowed: true, remaining: config.max - entry.attempts, retryAfterMs: 0 };
}

/**
 * Helper: Return a standard rate limit exceeded JSON response object (for use in server routes).
 * @param {number} retryAfterMs
 */
export function rateLimitExceededResponse(retryAfterMs) {
  const retryAfterSecs = Math.ceil(retryAfterMs / 1000);
  return {
    error: `Too many attempts. Please wait ${retryAfterSecs < 60 ? retryAfterSecs + ' seconds' : Math.ceil(retryAfterSecs / 60) + ' minutes'} before trying again.`,
    retryAfterSecs
  };
}

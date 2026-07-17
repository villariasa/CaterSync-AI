/**
 * src/lib/server/auth/session.js
 * 
 * Centralized session management.
 * Creates, validates, refreshes, and revokes sessions.
 * All session data lives in the `sessions` table.
 */

import { pool } from '$lib/server/db.js';
import { generateAccessToken, generateRefreshToken, hashToken } from './tokens.js';

// Access token lifetime: 15 minutes
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
// Refresh token lifetime: 60 days (extended to 90 days for trusted devices)
const REFRESH_TOKEN_TTL_DAYS = 60;
const REFRESH_TOKEN_TTL_TRUSTED_DAYS = 90;

/**
 * Create a new session and return the raw (unhashed) token pair.
 * Tokens are hashed before storage — only hashes in the DB.
 * 
 * @param {Object} opts
 * @param {number} opts.userId
 * @param {string} opts.userRole - 'subscriber' | 'org_user' | 'supplier' | 'platform_admin'
 * @param {string} [opts.deviceId]
 * @param {string} [opts.ipAddress]
 * @param {string} [opts.userAgent]
 * @param {boolean} [opts.isTrusted]
 * @returns {Promise<{ accessToken: string, refreshToken: string, sessionId: string }>}
 */
export async function createSession({ userId, userRole, deviceId, ipAddress, userAgent, isTrusted = false }) {
  const accessToken = generateAccessToken();
  const refreshToken = generateRefreshToken();
  const accessHash = hashToken(accessToken);
  const refreshHash = hashToken(refreshToken);

  const refreshDays = isTrusted ? REFRESH_TOKEN_TTL_TRUSTED_DAYS : REFRESH_TOKEN_TTL_DAYS;
  const expiresAt = new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000).toISOString();
  const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS).toISOString();

  try {
    const res = await pool.query(
      `INSERT INTO sessions 
        (user_id, user_role, access_token_hash, refresh_token_hash, device_id, ip_address, user_agent, expires_at, last_active_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING id`,
      [userId, userRole, accessHash, refreshHash, deviceId || null, ipAddress || null, userAgent || null, expiresAt]
    );

    return { accessToken, refreshToken, sessionId: res.rows[0].id };
  } catch (err) {
    console.error('[session.js] createSession error:', err);
    throw err;
  }
}

/**
 * Validate an access token. Returns session info or null if invalid.
 * @param {string} accessToken
 * @returns {Promise<Object|null>}
 */
export async function validateAccessToken(accessToken) {
  if (!accessToken) return null;

  try {
    const hash = hashToken(accessToken);
    const res = await pool.query(
      `SELECT id, user_id, user_role, device_id, expires_at, revoked_at, last_active_at
       FROM sessions
       WHERE access_token_hash = $1
         AND revoked_at IS NULL
         AND expires_at > NOW()
       LIMIT 1`,
      [hash]
    );

    if (res.rows.length === 0) return null;

    const session = res.rows[0];

    // Silently update last_active_at (non-blocking)
    pool.query('UPDATE sessions SET last_active_at = NOW() WHERE id = $1', [session.id]).catch(() => {});

    return session;
  } catch (err) {
    console.error('[session.js] validateAccessToken error:', err);
    return null;
  }
}

/**
 * Refresh a session using the refresh token.
 * Rotates the refresh token (old one is invalidated, new one issued).
 * 
 * @param {string} refreshToken
 * @param {string} [newIpAddress]
 * @returns {Promise<{ accessToken: string, refreshToken: string, session: Object }|null>}
 */
export async function refreshSession(refreshToken, newIpAddress) {
  if (!refreshToken) return null;

  try {
    const hash = hashToken(refreshToken);
    const res = await pool.query(
      `SELECT id, user_id, user_role, device_id, expires_at, revoked_at
       FROM sessions
       WHERE refresh_token_hash = $1
       LIMIT 1`,
      [hash]
    );

    if (res.rows.length === 0) return null;

    const session = res.rows[0];

    // Check if revoked or expired
    if (session.revoked_at || new Date(session.expires_at) < new Date()) {
      // Clean up stale session
      await pool.query('UPDATE sessions SET revoked_at = NOW(), revoke_reason = $1 WHERE id = $2', 
        ['expired', session.id]);
      return null;
    }

    // Generate new token pair (rotation)
    const newAccessToken = generateAccessToken();
    const newRefreshToken = generateRefreshToken();
    const newAccessHash = hashToken(newAccessToken);
    const newRefreshHash = hashToken(newRefreshToken);

    // Keep same expiry window from original session
    await pool.query(
      `UPDATE sessions SET
         access_token_hash = $1,
         refresh_token_hash = $2,
         last_active_at = NOW(),
         ip_address = COALESCE($3, ip_address)
       WHERE id = $4`,
      [newAccessHash, newRefreshHash, newIpAddress || null, session.id]
    );

    return { accessToken: newAccessToken, refreshToken: newRefreshToken, session };
  } catch (err) {
    console.error('[session.js] refreshSession error:', err);
    return null;
  }
}

/**
 * Revoke a specific session by ID.
 * @param {string} sessionId - UUID
 * @param {number} userId - to prevent cross-user revocation
 * @param {string} [reason]
 */
export async function revokeSession(sessionId, userId, reason = 'user_logout') {
  try {
    await pool.query(
      `UPDATE sessions SET revoked_at = NOW(), revoke_reason = $1
       WHERE id = $2 AND user_id = $3 AND revoked_at IS NULL`,
      [reason, sessionId, userId]
    );
  } catch (err) {
    console.error('[session.js] revokeSession error:', err);
  }
}

/**
 * Revoke ALL sessions for a user (logout all devices).
 * @param {number} userId
 * @param {string} userRole
 * @param {string} [exceptSessionId] - optional: keep current session alive
 */
export async function revokeAllSessions(userId, userRole, exceptSessionId) {
  try {
    await pool.query(
      `UPDATE sessions SET revoked_at = NOW(), revoke_reason = 'logout_all'
       WHERE user_id = $1 AND user_role = $2 AND revoked_at IS NULL
       ${exceptSessionId ? 'AND id != $3' : ''}`,
      exceptSessionId ? [userId, userRole, exceptSessionId] : [userId, userRole]
    );
  } catch (err) {
    console.error('[session.js] revokeAllSessions error:', err);
  }
}

/**
 * Revoke a session by its refresh token hash (used during logout flow).
 * @param {string} refreshToken
 */
export async function revokeByRefreshToken(refreshToken) {
  if (!refreshToken) return;
  try {
    const hash = hashToken(refreshToken);
    await pool.query(
      `UPDATE sessions SET revoked_at = NOW(), revoke_reason = 'user_logout'
       WHERE refresh_token_hash = $1 AND revoked_at IS NULL`,
      [hash]
    );
  } catch (err) {
    console.error('[session.js] revokeByRefreshToken error:', err);
  }
}

/**
 * Get all active sessions for a user (for device management page).
 * @param {number} userId
 * @param {string} userRole
 * @returns {Promise<Array>}
 */
export async function getActiveSessions(userId, userRole) {
  try {
    const res = await pool.query(
      `SELECT s.id, s.device_id, s.ip_address, s.user_agent, s.created_at, s.last_active_at, s.expires_at,
              d.device_name, d.browser, d.platform, d.os, d.is_trusted, d.last_country, d.last_city
       FROM sessions s
       LEFT JOIN user_devices d ON d.id = s.device_id
       WHERE s.user_id = $1 AND s.user_role = $2
         AND s.revoked_at IS NULL AND s.expires_at > NOW()
       ORDER BY s.last_active_at DESC`,
      [userId, userRole]
    );
    return res.rows;
  } catch (err) {
    console.error('[session.js] getActiveSessions error:', err);
    return [];
  }
}

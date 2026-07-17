/**
 * src/lib/server/auth/audit.js
 * 
 * Centralized auth event logging to login_history table.
 * All events are non-blocking (fire-and-forget) to avoid slowing auth flows.
 */

import { pool } from '$lib/server/db.js';

/**
 * Valid event types for login_history.event_type
 */
export const AUTH_EVENTS = {
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  OTP_SENT: 'otp_sent',
  OTP_VERIFIED: 'otp_verified',
  OTP_FAILED: 'otp_failed',
  LOGOUT: 'logout',
  LOGOUT_ALL: 'logout_all',
  TOKEN_REFRESH: 'token_refresh',
  DEVICE_TRUSTED: 'device_trusted',
  MAGIC_LINK_SENT: 'magic_link_sent',
  MAGIC_LINK_USED: 'magic_link_used',
  TOTP_VERIFIED: 'totp_verified',
  TOTP_FAILED: 'totp_failed',
  WEBAUTHN_SUCCESS: 'webauthn_success',
  WEBAUTHN_FAILED: 'webauthn_failed',
  GOOGLE_AUTH: 'google_auth',
  ACCOUNT_LOCKED: 'account_locked',
  PASSWORD_CHANGED: 'password_changed',
};

/**
 * Log an authentication event. Non-blocking — does not throw.
 * @param {Object} opts
 * @param {string} opts.eventType - one of AUTH_EVENTS
 * @param {number|null} [opts.userId]
 * @param {string|null} [opts.userRole]
 * @param {string|null} [opts.identifier] - email or username
 * @param {string|null} [opts.method] - 'otp', 'google', 'webauthn', 'totp', 'password', 'refresh_token'
 * @param {string|null} [opts.deviceId]
 * @param {string|null} [opts.ipAddress]
 * @param {string|null} [opts.userAgent]
 * @param {string|null} [opts.failureReason]
 * @param {number} [opts.riskScore]
 */
export function logAuthEvent({
  eventType,
  userId = null,
  userRole = null,
  identifier = null,
  method = null,
  deviceId = null,
  ipAddress = null,
  userAgent = null,
  failureReason = null,
  riskScore = 0
}) {
  // Fire and forget — never block the auth flow
  pool.query(
    `INSERT INTO login_history 
      (user_id, user_role, identifier, event_type, method, device_id, ip_address, user_agent, failure_reason, risk_score)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [userId, userRole, identifier, eventType, method, deviceId, ipAddress, userAgent, failureReason, riskScore]
  ).catch(err => {
    console.warn('[audit] Failed to log auth event:', eventType, err.message);
  });
}

/**
 * Get login history for a user (for security page).
 * @param {number} userId
 * @param {string} userRole
 * @param {number} [limit=50]
 * @returns {Promise<Array>}
 */
export async function getLoginHistory(userId, userRole, limit = 50) {
  try {
    const res = await pool.query(
      `SELECT id, event_type, method, device_id, ip_address, country, city,
              user_agent, failure_reason, risk_score, created_at
       FROM login_history
       WHERE user_id = $1 AND user_role = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [userId, userRole, limit]
    );
    return res.rows;
  } catch (err) {
    console.error('[audit] getLoginHistory error:', err);
    return [];
  }
}

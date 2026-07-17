/**
 * src/lib/server/auth/risk.js
 * 
 * Risk-Based Authentication engine.
 * Computes a risk score (0–100) for each login attempt.
 * Higher score = higher risk = stricter challenge required.
 */

import { pool } from '$lib/server/db.js';

/**
 * Risk score thresholds:
 * 0–20:  No challenge (trusted device, known context)
 * 21–50: OTP / email verification
 * 51–80: OTP + device confirmation prompt
 * 81+:   Block + flag for review (or require admin intervention)
 */
export const RISK_THRESHOLDS = {
  SILENT: 20,
  OTP: 50,
  OTP_PLUS: 80,
};

/**
 * Compute risk score for a login attempt.
 * @param {Object} opts
 * @param {number} opts.userId
 * @param {string} opts.userRole
 * @param {string|null} opts.deviceId
 * @param {boolean} opts.isDeviceTrusted
 * @param {string|null} opts.ipAddress
 * @param {string|null} opts.userAgent
 * @returns {Promise<{ score: number, factors: string[] }>}
 */
export async function computeRiskScore({ userId, userRole, deviceId, isDeviceTrusted, ipAddress, userAgent }) {
  let score = 0;
  const factors = [];

  // 1. Known trusted device → strong signal (−0 penalty, but gates the rest)
  if (isDeviceTrusted && deviceId) {
    factors.push('known_trusted_device');
    // Trusted device is a strong positive. Still check other signals.
  } else if (deviceId) {
    score += 15;
    factors.push('known_device_not_trusted');
  } else {
    score += 25;
    factors.push('unknown_device');
  }

  // 2. Check recent successful login history for this user
  try {
    const recentLogin = await pool.query(
      `SELECT ip_address, country, created_at
       FROM login_history
       WHERE user_id = $1 AND user_role = $2 AND event_type = 'login_success'
       ORDER BY created_at DESC LIMIT 5`,
      [userId, userRole]
    );

    if (recentLogin.rows.length > 0) {
      const lastLogin = recentLogin.rows[0];

      // Check for impossible travel (same user, < 3 hours, different country)
      if (lastLogin.country && ipAddress) {
        const lastCountry = lastLogin.country;
        // We can't do real geodistance without a GeoIP library, but we can flag country change
        // In production, use Cloudflare's CF-IPCountry header
        // For now: any country change within 2 hours = high risk
        const hoursSinceLast = (Date.now() - new Date(lastLogin.created_at).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLast < 2 && lastCountry !== null) {
          score += 40;
          factors.push('possible_impossible_travel');
        }
      }
    } else {
      // No login history — brand new account or first login
      score += 5;
      factors.push('no_login_history');
    }

    // 3. Check for recent failed attempts
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentFails = await pool.query(
      `SELECT COUNT(*) as count FROM login_history
       WHERE user_id = $1 AND user_role = $2 
         AND event_type = 'login_failed'
         AND created_at > $3`,
      [userId, userRole, oneHourAgo]
    );
    const failCount = parseInt(recentFails.rows[0].count, 10);
    if (failCount >= 3) {
      score += 20;
      factors.push(`recent_${failCount}_failed_attempts`);
    }
  } catch {
    // DB error during risk check — treat as slightly elevated
    score += 10;
    factors.push('risk_check_partial');
  }

  // 4. Suspicious User-Agent signals
  if (!userAgent || userAgent.length < 20) {
    score += 15;
    factors.push('missing_or_minimal_user_agent');
  }

  // Cap at 100
  return { score: Math.min(score, 100), factors };
}

/**
 * Determine what challenge is required based on risk score and device trust.
 * @param {number} score
 * @param {boolean} isTrusted
 * @param {boolean} hasWebAuthn - device has registered biometrics
 * @returns {'none' | 'otp' | 'otp_plus' | 'blocked'}
 */
export function getRequiredChallenge(score, isTrusted, hasWebAuthn = false) {
  // Trusted device + WebAuthn = always allow biometric, skip OTP
  if (isTrusted && hasWebAuthn) return 'none';
  // Trusted device, no biometrics — still skip OTP for low-risk
  if (isTrusted && score <= RISK_THRESHOLDS.OTP) return 'none';
  // Low risk — no challenge
  if (score <= RISK_THRESHOLDS.SILENT) return 'none';
  // Moderate risk — OTP
  if (score <= RISK_THRESHOLDS.OTP) return 'otp';
  // High risk — OTP + extra
  if (score <= RISK_THRESHOLDS.OTP_PLUS) return 'otp_plus';
  // Very high — block
  return 'blocked';
}

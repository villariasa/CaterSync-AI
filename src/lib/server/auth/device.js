/**
 * src/lib/server/auth/device.js
 * 
 * Device fingerprinting, trust management, and device registry.
 * Privacy-friendly: uses User-Agent + stable browser-generated UUID (not canvas fingerprinting).
 */

import { pool } from '$lib/server/db.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Parse a User-Agent string into browser/platform/OS components.
 * @param {string} ua
 * @returns {{ browser: string, platform: string, os: string, deviceName: string }}
 */
export function parseUserAgent(ua = '') {
  let browser = 'Unknown Browser';
  let platform = 'Unknown';
  let os = 'Unknown OS';

  if (!ua) return { browser, platform, os, deviceName: 'Unknown Device' };

  // Browser detection
  if (ua.includes('Edg/') || ua.includes('Edge/')) browser = 'Edge';
  else if (ua.includes('Chrome/') && !ua.includes('Chromium')) browser = 'Chrome';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('OPR/') || ua.includes('Opera/')) browser = 'Opera';
  else if (ua.includes('SamsungBrowser/')) browser = 'Samsung Browser';

  // OS detection
  if (ua.includes('Windows NT')) {
    os = 'Windows';
    platform = 'Desktop';
  } else if (ua.includes('Macintosh') || ua.includes('Mac OS X')) {
    if (ua.includes('iPhone') || ua.includes('iPad')) {
      os = ua.includes('iPad') ? 'iPadOS' : 'iOS';
      platform = 'Mobile';
    } else {
      os = 'macOS';
      platform = 'Desktop';
    }
  } else if (ua.includes('Android')) {
    os = 'Android';
    platform = 'Mobile';
  } else if (ua.includes('Linux')) {
    os = 'Linux';
    platform = 'Desktop';
  } else if (ua.includes('CrOS')) {
    os = 'ChromeOS';
    platform = 'Desktop';
  }

  const deviceName = `${browser} on ${os}`;
  return { browser, platform, os, deviceName };
}

/**
 * Get or create a device record.
 * The device_id comes from the `cs_device_id` cookie (set on first visit, JS-readable).
 * If no cookie exists, a new UUID is generated and returned for the client to store.
 * 
 * @param {Object} opts
 * @param {string|null} opts.deviceId - from cs_device_id cookie
 * @param {number} opts.userId
 * @param {string} opts.userRole
 * @param {string} opts.userAgent
 * @param {string} opts.ipAddress
 * @returns {Promise<{ deviceId: string, isNew: boolean, isTrusted: boolean }>}
 */
export async function getOrCreateDevice({ deviceId, userId, userRole, userAgent, ipAddress }) {
  const { browser, platform, os, deviceName } = parseUserAgent(userAgent);
  const country = null; // IP geolocation - can be added via Cloudflare CF-IPCountry header
  const city = null;

  // If no device ID from cookie, generate one
  const id = deviceId || uuidv4();

  try {
    // Check if device exists for this user
    const existing = await pool.query(
      'SELECT id, is_trusted FROM user_devices WHERE id = $1 AND user_id = $2 AND user_role = $3 LIMIT 1',
      [id, userId, userRole]
    );

    if (existing.rows.length > 0) {
      // Update last active info
      await pool.query(
        `UPDATE user_devices SET last_ip = $1, last_active_at = NOW(), 
         browser = $2, platform = $3, os = $4, device_name = $5
         WHERE id = $6`,
        [ipAddress, browser, platform, os, deviceName, id]
      );
      return { deviceId: id, isNew: false, isTrusted: existing.rows[0].is_trusted };
    }

    // New device — insert
    await pool.query(
      `INSERT INTO user_devices (id, user_id, user_role, device_name, browser, platform, os, last_ip, last_country, last_city)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING`,
      [id, userId, userRole, deviceName, browser, platform, os, ipAddress, country, city]
    );

    return { deviceId: id, isNew: true, isTrusted: false };
  } catch (err) {
    console.warn('[device.js] getOrCreateDevice error (non-fatal):', err.message);
    return { deviceId: id, isNew: true, isTrusted: false };
  }
}

/**
 * Mark a device as trusted for a user.
 * @param {string} deviceId
 * @param {number} userId
 * @param {string} userRole
 */
export async function trustDevice(deviceId, userId, userRole) {
  try {
    await pool.query(
      `UPDATE user_devices SET is_trusted = TRUE, trusted_at = NOW()
       WHERE id = $1 AND user_id = $2 AND user_role = $3`,
      [deviceId, userId, userRole]
    );
  } catch (err) {
    console.error('[device.js] trustDevice error:', err);
  }
}

/**
 * Check if a device is trusted for a user.
 * @param {string|null} deviceId
 * @param {number} userId
 * @param {string} userRole
 * @returns {Promise<boolean>}
 */
export async function isDeviceTrusted(deviceId, userId, userRole) {
  if (!deviceId) return false;
  try {
    const res = await pool.query(
      'SELECT is_trusted FROM user_devices WHERE id = $1 AND user_id = $2 AND user_role = $3 LIMIT 1',
      [deviceId, userId, userRole]
    );
    return res.rows.length > 0 && res.rows[0].is_trusted === true;
  } catch {
    return false;
  }
}

/**
 * Get all devices for a user.
 * @param {number} userId
 * @param {string} userRole
 * @returns {Promise<Array>}
 */
export async function getUserDevices(userId, userRole) {
  try {
    const res = await pool.query(
      `SELECT id, device_name, browser, platform, os, last_ip, last_country, last_city,
              is_trusted, trusted_at, last_active_at, created_at
       FROM user_devices
       WHERE user_id = $1 AND user_role = $2
       ORDER BY last_active_at DESC`,
      [userId, userRole]
    );
    return res.rows;
  } catch (err) {
    console.error('[device.js] getUserDevices error:', err);
    return [];
  }
}

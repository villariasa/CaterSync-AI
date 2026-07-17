/**
 * GET  /api/auth/devices     → List all active sessions/devices
 * POST /api/auth/devices     → Trust device / logout device / logout all
 */

import { json } from '@sveltejs/kit';
import { getActiveSessions, revokeSession, revokeAllSessions } from '$lib/server/auth/session.js';
import { trustDevice, getUserDevices } from '$lib/server/auth/device.js';
import { logAuthEvent, AUTH_EVENTS } from '$lib/server/auth/audit.js';

export async function GET({ locals }) {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sessions = await getActiveSessions(locals.user.id, locals.user.type);
  const devices = await getUserDevices(locals.user.id, locals.user.type);

  return json({
    success: true,
    currentSessionId: locals.sessionId,
    currentDeviceId: locals.user.deviceId,
    sessions,
    devices
  });
}

export async function POST({ locals, request }) {
  if (!locals.user) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { action, sessionId, deviceId } = await request.json();

  if (action === 'trust') {
    const targetDevice = deviceId || locals.user.deviceId;
    if (!targetDevice) {
      return json({ error: 'No device ID provided.' }, { status: 400 });
    }
    await trustDevice(targetDevice, locals.user.id, locals.user.type);
    logAuthEvent({
      eventType: AUTH_EVENTS.DEVICE_TRUSTED,
      userId: locals.user.id,
      userRole: locals.user.type,
      deviceId: targetDevice
    });
    return json({ success: true, message: 'Device marked as trusted.' });
  }

  if (action === 'logout_device') {
    if (!sessionId) {
      return json({ error: 'Session ID is required.' }, { status: 400 });
    }
    await revokeSession(sessionId, locals.user.id, 'user_initiated_device_logout');
    logAuthEvent({
      eventType: AUTH_EVENTS.LOGOUT,
      userId: locals.user.id,
      userRole: locals.user.type,
      failureReason: `device_logout:${sessionId}`
    });
    return json({ success: true, message: 'Device session revoked.' });
  }

  if (action === 'logout_all') {
    // Optionally keep current session alive
    const keepCurrent = request.headers.get('x-keep-current') === '1';
    await revokeAllSessions(
      locals.user.id,
      locals.user.type,
      keepCurrent ? locals.sessionId : null
    );
    logAuthEvent({
      eventType: AUTH_EVENTS.LOGOUT_ALL,
      userId: locals.user.id,
      userRole: locals.user.type
    });
    return json({ success: true, message: 'All sessions revoked.' });
  }

  return json({ error: 'Unknown action.' }, { status: 400 });
}
